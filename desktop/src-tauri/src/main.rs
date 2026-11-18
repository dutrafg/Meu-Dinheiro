#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::{json, Value};
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};

const FILE_NAME: &str = "meu-dinheiro-dados.json";
const MAX_JSON_BYTES: usize = 12 * 1024 * 1024;

struct Mirror {
    folder: PathBuf,
    bytes: Option<Vec<u8>>,
}
struct AppState {
    db: Mutex<Connection>,
    pending_folder: Mutex<Option<PathBuf>>,
    mirror: Mutex<Option<Mirror>>,
    operation: Mutex<()>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupStatus {
    code: &'static str,
    folder: String,
    message: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderChoice {
    folder: String,
    conflict: bool,
}

fn status(code: &'static str, folder: Option<&Path>, message: impl Into<String>) -> BackupStatus {
    BackupStatus {
        code,
        folder: folder
            .and_then(Path::file_name)
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default(),
        message: message.into(),
    }
}

fn validate_data(payload: &str) -> Result<Value, String> {
    if payload.len() > MAX_JSON_BYTES {
        return Err("Dados muito grandes para o banco local (limite: 12 MB).".into());
    }
    let value: Value = serde_json::from_str(payload).map_err(|_| "Dados JSON inválidos.")?;
    for field in ["transactions", "goals", "allocations", "completedAportes"] {
        if !value.get(field).is_some_and(Value::is_array) {
            return Err(format!("O campo {field} não é uma lista válida."));
        }
    }
    Ok(value)
}

fn validate_existing(bytes: &[u8]) -> Result<Value, String> {
    let value: Value = serde_json::from_slice(bytes)
        .map_err(|_| "A pasta contém JSON inválido; escolha outra pasta.")?;
    if value.get("app").and_then(Value::as_str) != Some("meu-dinheiro-essencial")
        || value.get("version").and_then(Value::as_u64) != Some(1)
        || !value.get("transactions").is_some_and(Value::is_array)
        || !value.get("goals").is_some_and(Value::is_array)
    {
        return Err("A pasta contém um arquivo incompatível; escolha outra pasta para protegê-lo.".into());
    }
    Ok(value)
}

fn same_finances(left: &Value, right: &Value) -> bool {
    ["transactions", "goals", "allocations", "completedAportes"]
        .iter()
        .all(|field| {
            let a: &[Value] = left.get(*field).and_then(Value::as_array).map_or(&[], Vec::as_slice);
            let b: &[Value] = right.get(*field).and_then(Value::as_array).map_or(&[], Vec::as_slice);
            a == b
        })
}

fn read_optional(path: &Path) -> Result<Option<Vec<u8>>, String> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Não foi possível ler {}: {error}", path.display())),
    }
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Pasta de destino inválida.")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = parent.join(format!(".meu-dinheiro-{}-{}.tmp", std::process::id(), Utc::now().timestamp_nanos_opt().unwrap_or_default()));
    let result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new().create_new(true).write(true).open(&temporary)
            .map_err(|error| error.to_string())?;
        file.write_all(bytes).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        fs::rename(&temporary, path).map_err(|error| error.to_string())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

fn archive_previous(folder: &Path, bytes: &[u8]) -> Result<(), String> {
    let history = folder.join("historico");
    fs::create_dir_all(&history).map_err(|error| error.to_string())?;
    let path = history.join(format!("meu-dinheiro-anterior-{}.json", Utc::now().format("%Y%m%dT%H%M%S%f")));
    let mut file = OpenOptions::new().create_new(true).write(true).open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())
}

fn current_data(state: &AppState) -> Result<String, String> {
    let db = state.db.lock().map_err(|_| "Banco bloqueado.")?;
    Ok(db.query_row("SELECT payload FROM app_data WHERE id=1", [], |row| row.get(0))
        .optional().map_err(|error| error.to_string())?
        .unwrap_or_else(|| json!({"transactions":[],"goals":[],"allocations":[],"completedAportes":[]}).to_string()))
}

fn configured_folder(state: &AppState) -> Result<Option<PathBuf>, String> {
    let db = state.db.lock().map_err(|_| "Banco bloqueado.")?;
    let path: Option<String> = db.query_row("SELECT value FROM settings WHERE key='backup_folder'", [], |row| row.get(0))
        .optional().map_err(|error| error.to_string())?;
    Ok(path.map(PathBuf::from))
}

fn snapshot_bytes(current: &Value) -> Result<Vec<u8>, String> {
    serde_json::to_vec_pretty(&json!({
        "app":"meu-dinheiro-essencial", "version":1, "exportedAt":Utc::now().to_rfc3339(),
        "transactions":current["transactions"], "goals":current["goals"],
        "allocations":current["allocations"], "completedAportes":current["completedAportes"]
    })).map_err(|error| error.to_string())
}

fn sync_inner(state: &AppState) -> BackupStatus {
    let folder = match configured_folder(state) {
        Ok(Some(path)) => path,
        Ok(None) => return status("off", None, "Escolha uma pasta para ativar o backup automático."),
        Err(error) => return status("error", None, error),
    };
    let result = (|| -> Result<&'static str, String> {
        if !folder.is_dir() { return Err("A pasta não está acessível. Conecte o disco ou escolha outra pasta.".into()); }
        let payload = current_data(state)?;
        let current: Value = serde_json::from_str(&payload).map_err(|error| error.to_string())?;
        let existing = read_optional(&folder.join(FILE_NAME))?;
        let mut mirror = state.mirror.lock().map_err(|_| "Backup bloqueado.")?;
        if let Some(last) = mirror.as_ref().filter(|last| last.folder == folder) {
            if last.bytes != existing {
                return Ok("conflict");
            }
        } else if let Some(bytes) = &existing {
            if !same_finances(&validate_existing(bytes)?, &current) { return Ok("conflict"); }
        }
        let contents = snapshot_bytes(&current)?;
        atomic_write(&folder.join(FILE_NAME), &contents)?;
        *mirror = Some(Mirror {folder:folder.clone(),bytes:Some(contents.clone())});
        let daily = folder.join("historico").join(format!("meu-dinheiro-{}.json", Utc::now().format("%Y-%m-%d")));
        atomic_write(&daily, &contents)?;
        Ok("saved")
    })();
    match result {
        Ok("saved") => status("saved", Some(&folder), "Dados gravados no SQLite e na pasta automaticamente."),
        Ok("conflict") => status("conflict", Some(&folder), "O arquivo da pasta mudou fora do aplicativo. Nenhum backup foi sobrescrito."),
        Ok(_) => unreachable!(),
        Err(error) => status("error", Some(&folder), format!("SQLite preservado. Falha no backup: {error}")),
    }
}

#[tauri::command]
fn load_data(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|_| "Banco bloqueado.")?;
    db.query_row("SELECT payload FROM app_data WHERE id=1", [], |row| row.get(0))
        .optional().map_err(|error| error.to_string())
}

#[tauri::command]
fn save_data(payload: String, state: State<'_, AppState>) -> Result<BackupStatus, String> {
    validate_data(&payload)?;
    let _lock = state.operation.lock().map_err(|_| "Banco ocupado.")?;
    {
        let db = state.db.lock().map_err(|_| "Banco bloqueado.")?;
        db.execute("INSERT INTO app_data(id,payload,updated_at) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
            params![payload, Utc::now().to_rfc3339()]).map_err(|error| error.to_string())?;
    }
    Ok(sync_inner(&state))
}

#[tauri::command]
fn backup_status(state: State<'_, AppState>) -> Result<BackupStatus, String> {
    let _lock = state.operation.lock().map_err(|_| "Backup ocupado.")?;
    let folder = match configured_folder(&state)? {
        Some(path) => path,
        None => return Ok(status("off", None, "Escolha uma pasta para ativar o backup automático.")),
    };
    if !folder.is_dir() { return Ok(status("error", Some(&folder), "A pasta não está acessível.")); }
    let existing = read_optional(&folder.join(FILE_NAME))?;
    if let Some(bytes) = &existing {
        let previous = validate_existing(bytes)?;
        let current: Value = serde_json::from_str(&current_data(&state)?).map_err(|error| error.to_string())?;
        if !same_finances(&previous, &current) {
            return Ok(status("conflict", Some(&folder), "O backup difere do banco. Confirme antes de sobrescrever."));
        }
    }
    *state.mirror.lock().map_err(|_| "Backup bloqueado.")? = Some(Mirror {folder:folder.clone(),bytes:existing});
    Ok(status("ready", Some(&folder), "Pasta conectada; mudanças serão salvas automaticamente."))
}

#[tauri::command]
async fn select_backup_folder(state: State<'_, AppState>) -> Result<Option<FolderChoice>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new().set_title("Selecione uma pasta para o Meu Dinheiro").pick_folder()
    }).await.map_err(|error| error.to_string())?;
    let Some(folder) = picked else { return Ok(None); };
    if !folder.is_dir() { return Err("A pasta selecionada está indisponível.".into()); }
    let current: Value = serde_json::from_str(&current_data(&state)?).map_err(|error| error.to_string())?;
    let existing = read_optional(&folder.join(FILE_NAME))?;
    let conflict = existing.as_ref().map(|bytes| validate_existing(bytes).map(|value| !same_finances(&value, &current)))
        .transpose()?.unwrap_or(false);
    *state.pending_folder.lock().map_err(|_| "Seleção bloqueada.")? = Some(folder.clone());
    Ok(Some(FolderChoice {folder:status("ready",Some(&folder),"").folder,conflict}))
}

#[tauri::command]
fn activate_backup_folder(allow_replace: bool, state: State<'_, AppState>) -> Result<BackupStatus, String> {
    let _lock = state.operation.lock().map_err(|_| "Backup ocupado.")?;
    let folder = state.pending_folder.lock().map_err(|_| "Seleção bloqueada.")?
        .take().ok_or("Selecione a pasta antes de ativar.")?;
    let existing = read_optional(&folder.join(FILE_NAME))?;
    let current: Value = serde_json::from_str(&current_data(&state)?).map_err(|error| error.to_string())?;
    if let Some(bytes) = &existing {
        let previous = validate_existing(bytes)?;
        if !same_finances(&previous, &current) {
            if !allow_replace { return Ok(status("conflict", Some(&folder), "Operação cancelada; backup preservado.")); }
            archive_previous(&folder, bytes)?;
        }
    }
    {
        let db = state.db.lock().map_err(|_| "Banco bloqueado.")?;
        db.execute("INSERT INTO settings(key,value) VALUES('backup_folder',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [folder.to_string_lossy().as_ref()]).map_err(|error| error.to_string())?;
    }
    *state.mirror.lock().map_err(|_| "Backup bloqueado.")? = Some(Mirror {folder,bytes:existing});
    Ok(sync_inner(&state))
}

#[tauri::command]
fn sync_backup(state: State<'_, AppState>) -> Result<BackupStatus, String> {
    let _lock = state.operation.lock().map_err(|_| "Backup ocupado.")?;
    Ok(sync_inner(&state))
}

#[tauri::command]
fn resolve_backup_conflict(state: State<'_, AppState>) -> Result<BackupStatus, String> {
    let _lock = state.operation.lock().map_err(|_| "Backup ocupado.")?;
    let folder = configured_folder(&state)?.ok_or("Pasta não selecionada.")?;
    if !folder.is_dir() { return Err("A pasta não está acessível.".into()); }
    let existing = read_optional(&folder.join(FILE_NAME))?;
    if let Some(bytes) = &existing {
        validate_existing(bytes)?;
        archive_previous(&folder, bytes)?;
    }
    *state.mirror.lock().map_err(|_| "Backup bloqueado.")? = Some(Mirror {folder,bytes:existing});
    Ok(sync_inner(&state))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            fs::create_dir_all(&directory)?;
            let connection = Connection::open(directory.join("meu-dinheiro.sqlite3"))?;
            connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
                CREATE TABLE IF NOT EXISTS app_data(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);")?;
            app.manage(AppState {
                db:Mutex::new(connection), pending_folder:Mutex::new(None),
                mirror:Mutex::new(None), operation:Mutex::new(()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_data, save_data, backup_status, select_backup_folder,
            activate_backup_folder, sync_backup, resolve_backup_conflict
        ])
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar Meu Dinheiro para Windows");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_saved_state_and_rejects_incomplete_data() {
        assert!(validate_data(r#"{"transactions":[],"goals":[],"allocations":[],"completedAportes":[]}"#).is_ok());
        assert!(validate_data(r#"{"transactions":{}}"#).is_err());
        assert!(validate_existing(br#"{"app":"errado","version":1,"transactions":[],"goals":[]}"#).is_err());
    }
    #[test]
    fn compares_backup_ignoring_export_timestamp() {
        let current = validate_data(r#"{"transactions":[],"goals":[],"allocations":[],"completedAportes":[]}"#).unwrap();
        let previous = validate_existing(br#"{"app":"meu-dinheiro-essencial","version":1,"exportedAt":"ontem","transactions":[],"goals":[]}"#).unwrap();
        assert!(same_finances(&current, &previous));
        let changed = validate_existing(br#"{"app":"meu-dinheiro-essencial","version":1,"transactions":[{"amount":3}],"goals":[]}"#).unwrap();
        assert!(!same_finances(&current, &changed));
    }
}
