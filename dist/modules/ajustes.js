import {CORES,TEMAS,normalizarPreferencias,ICONES_PERSONALIZADOS} from './preferencias.js';

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
  const listaCategorias=document.getElementById('category-manager-list');
  const formCategoria=document.getElementById('category-manager-form');
  const tipoCategoria=document.getElementById('category-manager-kind');
  const iconeCategoria=formCategoria?.elements?.namedItem?.('icon');
  let pending=null;
  if(iconeCategoria)for(const emoji of ICONES_PERSONALIZADOS){const option=document.createElement('option');option.value=emoji;option.textContent=`${emoji} Ícone`;iconeCategoria.append(option);}
  function categoriaTipo(){return tipoCategoria.value==='income'?'income':'expense';}
  function resetarCategoria(){formCategoria.reset();formCategoria.elements.namedItem('oldName').value='';document.getElementById('category-manager-save').textContent='+ Criar categoria';}
  function renderCategorias(){
    if(!iconeCategoria||!listaCategorias?.replaceChildren||!tipoCategoria)return;
    listaCategorias.replaceChildren();
    const prefs=atual(),tipo=categoriaTipo();
    const nomes=[...new Set([...CATEGORIES[tipo],...prefs.categoriasExtras[tipo]])];
    for(const nome of nomes){
      const oculta=prefs.categoriasOcultas[tipo].includes(nome);
      const linha=document.createElement('div');linha.className='category-manager-item';
      const titulo=document.createElement('span');titulo.textContent=`${prefs.categoriaIcones[nome]||'🏷️'} ${nome}${oculta?' (oculta)':''}`;
      const mudar=document.createElement('button');mudar.type='button';mudar.textContent='Mudar';mudar.dataset.categoryEdit=nome;mudar.className='button button-secondary';
      const tirar=document.createElement('button');tirar.type='button';tirar.textContent=oculta?'Mostrar':'Tirar';tirar.dataset.categoryToggle=nome;tirar.className='button button-secondary';
      linha.append(titulo,mudar,tirar);listaCategorias.append(linha);
    }
  }
  function salvarCategoria(next,{atualizarLista=true}={}){
    if(!gestor.salvar(next)){estado('Não foi possível salvar categorias.',true);notify('Falha ao salvar categorias.');return false;}
    if(atualizarLista)renderCategorias();
    render();onSave?.();estado('Categorias salvas. O histórico foi preservado.');return true;
  }
  tipoCategoria?.addEventListener?.('change',()=>{resetarCategoria();renderCategorias();});
  listaCategorias?.addEventListener?.('click',event=>{
    const editar=event.target.closest('[data-category-edit]');const toggle=event.target.closest('[data-category-toggle]');
    if(!editar&&!toggle)return;
    const prefs=atual(),tipo=categoriaTipo(),nome=(editar||toggle).dataset.categoryEdit||(editar||toggle).dataset.categoryToggle;
    if(editar){formCategoria.elements.namedItem('oldName').value=nome;formCategoria.elements.namedItem('name').value=nome;iconeCategoria.value=prefs.categoriaIcones[nome]||'🏷️';document.getElementById('category-manager-save').textContent='Salvar mudança';formCategoria.elements.namedItem('name').focus();return;}
    const ocultas=prefs.categoriasOcultas[tipo];
    prefs.categoriasOcultas[tipo]=ocultas.includes(nome)?ocultas.filter(v=>v!==nome):[...ocultas,nome];
    // Mantenha o botão tocado no DOM: recriar toda a lista perde foco e pode jogar
    // o usuário para o início da tela ao ocultar várias categorias no celular.
    if(salvarCategoria(prefs,{atualizarLista:false})){
      const ocultaAgora=prefs.categoriasOcultas[tipo].includes(nome);
      const rotulo=toggle.closest('.category-manager-item')?.querySelector('span');
      if(rotulo)rotulo.textContent=`${prefs.categoriaIcones[nome]||'🏷️'} ${nome}${ocultaAgora?' (oculta)':''}`;
      toggle.textContent=ocultaAgora?'Mostrar':'Tirar';
    }
  });
  formCategoria?.addEventListener?.('submit',event=>{
    event.preventDefault();const prefs=atual(),tipo=categoriaTipo(),campo=formCategoria.elements;
    const nome=campo.namedItem('name').value.trim(),anterior=campo.namedItem('oldName').value;
    const nomes=[...CATEGORIES[tipo],...prefs.categoriasExtras[tipo]];
    if(!nome||nome.length>50||/[<>\r\n]/.test(nome)||nomes.some(v=>v.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR')&&v!==anterior)){
      notify('Nome inválido ou categoria já existente.');return;
    }
    if(anterior&&anterior!==nome){
      // Renomear não reclassifica registros já salvos; o nome antigo é ocultado.
      if(!prefs.categoriasOcultas[tipo].includes(anterior))prefs.categoriasOcultas[tipo].push(anterior);
    }
    if(!nomes.includes(nome)){
      if(prefs.categoriasExtras[tipo].length>=50){notify('Limite de 50 categorias personalizadas. Oculte ou reutilize uma categoria.');return;}
      prefs.categoriasExtras[tipo].push(nome);
    }
    prefs.categoriasOcultas[tipo]=prefs.categoriasOcultas[tipo].filter(n=>n!==nome);
    prefs.categoriaIcones[nome]=campo.namedItem('icon').value;
    if(salvarCategoria(prefs))resetarCategoria();
  });
  document.getElementById('category-manager-cancel')?.addEventListener?.('click',resetarCategoria);
  function estado(message,error=false){
    if(status){status.textContent=message;status.dataset.state=error?'error':'ok';}
  }
  function abrir() {
    hideBackupMenu();
    const prefs=atual();
    renderCategorias();
    form.elements.namedItem('tema').value=prefs.tema;
    form.elements.namedItem('percentual').value=prefs.percentual;
    form.elements.namedItem('limiteMensal').value=prefs.limiteMensal??'';
    form.elements.namedItem('metaPoupancaMensal').value=prefs.metaPoupancaMensal??'';
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
    const leituraMonetaria=nome=>{
      const texto=String(form.elements.namedItem(nome).value).trim();
      const valor=Number(texto);
      return texto===''?null:Number.isFinite(valor)&&valor>0&&valor<=999999999?valor:NaN;
    };
    const limiteMensal=leituraMonetaria('limiteMensal');
    const metaPoupancaMensal=leituraMonetaria('metaPoupancaMensal');
    if(Number.isNaN(limiteMensal)||Number.isNaN(metaPoupancaMensal)){
      estado('Limite e meta devem ser maiores que zero; deixe vazio para desativar.',true);
      return false;
    }
    const prefs=normalizarPreferencias({...atual(),tema:form.elements.namedItem('tema').value,
      cor:form.querySelector('input[name="cor"]:checked')?.value,
      percentual,categoriasAporte:[...form.querySelectorAll('input[name="categoriaAporte"]:checked')].map(el=>el.value),
      reservaGoalId:reserva.value,limiteMensal,metaPoupancaMensal},CATEGORIES.income);
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
    if(!['percentual','limiteMensal','metaPoupancaMensal'].includes(event.target?.name))return;
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
