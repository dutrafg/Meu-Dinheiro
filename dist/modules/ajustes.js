import {CORES,TEMAS,normalizarPreferencias} from './preferencias.js';

const ROTULOS_CORES={verde:'Verde',azul:'Azul',roxo:'Roxo',laranja:'Laranja',rosa:'Rosa',turquesa:'Turquesa'};

export function aplicarAparencia(preferencias) {
  const root=document.documentElement;
  root.dataset.theme=preferencias.tema;
  root.dataset.accent=preferencias.cor;
  const esquema=preferencias.tema==='escuro'||(preferencias.tema==='auto'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches)?'dark':'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=esquema==='dark'?'#131417':'#f5f6f8';
  return esquema;
}

export function iniciarAjustes({gestor,getData,CATEGORIES,notify,render,onSave,hideBackupMenu}) {
  const dialogo=document.getElementById('settings-dialog');
  const form=document.getElementById('settings-form');
  const categorias=document.getElementById('settings-categories');
  const cores=document.getElementById('settings-colors');
  const reserva=document.getElementById('settings-reserve');
  const atual=()=>gestor.obter();
  function abrir() {
    hideBackupMenu();
    const prefs=atual();
    form.elements.namedItem('tema').value=prefs.tema;
    form.elements.namedItem('percentual').value=prefs.percentual;
    cores.replaceChildren();
    for(const [codigo,hex] of Object.entries(CORES)){
      const label=document.createElement('label');label.className='settings-color-option';
      const input=document.createElement('input');input.type='radio';input.name='cor';input.value=codigo;input.checked=prefs.cor===codigo;
      const amostra=document.createElement('span');amostra.className='settings-color-dot';amostra.style.background=hex;
      label.append(input,amostra,document.createTextNode(ROTULOS_CORES[codigo]));cores.append(label);
    }
    categorias.replaceChildren();
    for(const nome of CATEGORIES.income){
      const label=document.createElement('label');label.className='settings-check-option';
      const input=document.createElement('input');input.type='checkbox';input.name='categoriaAporte';input.value=nome;input.checked=prefs.categoriasAporte.includes(nome);
      label.append(input,document.createTextNode(nome));categorias.append(label);
    }
    reserva.replaceChildren();
    for(const goal of [{id:'',name:'Automático (nome Reserva / Emergência)'},...getData().goals.filter(g=>g.kind==='goal')]){
      const option=document.createElement('option');option.value=goal.id;option.textContent=goal.name;reserva.append(option);
    }
    reserva.value=prefs.reservaGoalId;
    if(reserva.selectedIndex<0)reserva.value='';
    dialogo.showModal();
  }
  document.getElementById('open-settings').addEventListener('click',abrir);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const percentual=Number(form.elements.namedItem('percentual').value);
    if(!Number.isFinite(percentual)||percentual<0||percentual>100){notify('Informe um percentual entre 0% e 100%.');return;}
    const prefs=normalizarPreferencias({tema:form.elements.namedItem('tema').value,
      cor:form.querySelector('input[name="cor"]:checked')?.value,
      percentual,categoriasAporte:[...form.querySelectorAll('input[name="categoriaAporte"]:checked')].map(el=>el.value),
      reservaGoalId:reserva.value},CATEGORIES.income);
    if(!gestor.salvar(prefs)){notify('Não foi possível salvar as preferências neste dispositivo.');return;}
    aplicarAparencia(prefs);dialogo.close();render();onSave?.();notify('Ajustes salvos neste dispositivo.');
  });
  document.getElementById('settings-cancel').addEventListener('click',()=>dialogo.close());
  document.getElementById('settings-form-cancel').addEventListener('click',()=>dialogo.close());
  dialogo.addEventListener('click',event=>{if(event.target===dialogo)dialogo.close();});
  // Não empilhar diagnósticos sobre o diálogo de ajustes.
  document.getElementById('open-diagnostics').addEventListener('click',()=>dialogo.close());
  for(const id of ['export-csv','import-csv','export-data','import-data','folder-backup-connect','folder-backup-reconnect','check-update','install-update']){
    document.getElementById(id).addEventListener('click',()=>dialogo.close());
  }
  const scheme=window.matchMedia?.('(prefers-color-scheme: dark)');
  scheme?.addEventListener?.('change',()=>{if(atual().tema==='auto')aplicarAparencia(atual());});
  aplicarAparencia(atual());
  return {abrir,aplicar:()=>aplicarAparencia(atual())};
}
