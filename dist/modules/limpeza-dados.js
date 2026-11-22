// Exclusão voluntária de dados financeiros somente desta origem do navegador.
// A primeira confirmação é visual; a segunda exige a frase exata digitada.
import {cliqueForaDoDialogo} from './dialogos.js';
export const FRASE_LIMPEZA='APAGAR';
export const validarFraseLimpeza=valor=>valor===FRASE_LIMPEZA;

export async function apagarDadosLocais({storage,chave,pausarBackup,antesRemocao,aposLimpeza}){
  if(!storage||typeof storage.removeItem!=='function'||!chave)return false;
  try{
    // A exclusão não pode engolir edições feitas em outra aba durante o processo.
    const ler=typeof storage.getItem==='function'?()=>storage.getItem(chave):null;
    const original=ler?.();
    await pausarBackup?.();
    if(ler&&ler()!==original)return false;
    await antesRemocao?.();
    if(ler&&ler()!==original)return false;
    storage.removeItem(chave);
  }catch{return false;}
  aposLimpeza?.();
  return true;
}

export function iniciarLimpezaDados({confirmar,apagarDados,notify,documento=document}){
  const abrir=documento.getElementById('delete-all-data');
  const dialogo=documento.getElementById('delete-data-dialog');
  const formulario=documento.getElementById('delete-data-form');
  const frase=documento.getElementById('delete-data-phrase');
  const executar=documento.getElementById('delete-data-confirm');
  const cancelar=documento.getElementById('delete-data-cancel');
  let primeiroPasso=false;
  let aguardando=false;
  let removendo=false;
  const habilitar=()=>{executar.disabled=removendo||!primeiroPasso||!validarFraseLimpeza(frase.value);};

  abrir.addEventListener('click',async()=>{
    if(aguardando||removendo||dialogo.open)return;
    aguardando=true;
    try{
      const aceitou=await confirmar({
        titulo:'Apagar os dados financeiros?',
        mensagem:'Esta ação remove os lançamentos, metas, sonhos, aplicações e lembretes deste navegador. As preferências e os arquivos de backup permanecem. O backup automático na pasta será pausado. Deseja continuar?',
        acao:'Continuar para confirmação final',perigoso:true
      });
      if(!aceitou)return;
      if(typeof dialogo.showModal!=='function'){
        notify('Seu navegador não permite a confirmação final segura. Nenhum dado foi apagado.');
        return;
      }
      frase.value='';primeiroPasso=true;habilitar();dialogo.showModal();frase.focus();
    }catch{primeiroPasso=false;notify('Não foi possível abrir a confirmação. Nenhum dado foi apagado.');}
    finally{aguardando=false;}
  });

  frase.addEventListener('input',habilitar);
  formulario.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!primeiroPasso||removendo||!validarFraseLimpeza(frase.value))return;
    removendo=true;habilitar();
    try{
      const feito=await apagarDados();
      if(feito){primeiroPasso=false;dialogo.close();notify('Dados financeiros apagados deste navegador. Backups externos preservados.');}
      else notify('Não foi possível apagar os dados. Verifique o armazenamento do navegador.');
    }catch{notify('Falha ao apagar os dados. Nenhuma exclusão foi confirmada.');}
    finally{removendo=false;habilitar();}
  });
  cancelar.addEventListener('click',()=>{if(!removendo)dialogo.close();});
  dialogo.addEventListener('cancel',event=>{if(removendo)event.preventDefault();});
  dialogo.addEventListener('click',event=>{if(cliqueForaDoDialogo(event,dialogo)&&!removendo)dialogo.close();});
  dialogo.addEventListener('close',()=>{primeiroPasso=false;frase.value='';habilitar();});
  return {abrir:()=>abrir.click(),validarFrase:validarFraseLimpeza};
}
