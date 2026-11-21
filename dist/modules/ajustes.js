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
  const pagina=document.getElementById('settings-page');
  const form=document.getElementById('settings-form');
  const categorias=document.getElementById('settings-categories');
  const cores=document.getElementById('settings-colors');
  const reserva=document.getElementById('settings-reserve');
  const atual=()=>gestor.obter();
  const status=document.getElementById('settings-autosave-status');
  let pending=null;
  function estado(message,error=false){
    if(status){status.textContent=message;status.dataset.state=error?'error':'ok';}
  }
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
  }
  // Grava apenas configurações válidas. Mudanças em contas e lançamentos nunca
  // passam por este formulário nem provocam uma escrita nesses dados.
  function salvarAutomaticamente(){
    if(pending!==null){clearTimeout(pending);pending=null;}
    const campo=form.elements.namedItem('percentual');
    const percentual=Number(campo.value);
    if(String(campo.value).trim()===''||!Number.isFinite(percentual)||percentual<0||percentual>100){
      estado('Informe um percentual válido de 0% a 100%. Nada foi alterado.',true);
      return false;
    }
    const prefs=normalizarPreferencias({tema:form.elements.namedItem('tema').value,
      cor:form.querySelector('input[name="cor"]:checked')?.value,
      percentual,categoriasAporte:[...form.querySelectorAll('input[name="categoriaAporte"]:checked')].map(el=>el.value),
      reservaGoalId:reserva.value},CATEGORIES.income);
    if(JSON.stringify(prefs)===JSON.stringify(atual())){
      aplicarAparencia(prefs);estado('Tudo salvo automaticamente.');return true;
    }
    if(!gestor.salvar(prefs)){
      estado('Não foi possível salvar neste dispositivo. Verifique o armazenamento.',true);
      notify('Não foi possível salvar as preferências.');return false;
    }
    aplicarAparencia(prefs);render();onSave?.();estado('Alterações salvas automaticamente.');
    return true;
  }
  form.addEventListener('change',salvarAutomaticamente);
  form.addEventListener('input',event=>{
    if(event.target?.name!=='percentual')return;
    if(pending!==null)clearTimeout(pending);
    pending=setTimeout(salvarAutomaticamente,500);
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();salvarAutomaticamente();
  });
  // Ao sair, grava a digitação válida ainda pendente e preserva o tema aplicado.
  function concluirEdicao(){if(pending!==null)salvarAutomaticamente();aplicarAparencia(atual());}
  const scheme=window.matchMedia?.('(prefers-color-scheme: dark)');
  scheme?.addEventListener?.('change',()=>{
    if(atual().tema==='auto')aplicarAparencia(atual());
  });
  aplicarAparencia(atual());
  return {abrir,concluirEdicao,aplicar:()=>aplicarAparencia(atual())};
}
