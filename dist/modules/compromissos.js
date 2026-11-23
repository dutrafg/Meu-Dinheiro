import {validarDataISO} from './validacao.js';

const MES=/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/;
export const TIPOS_COMPROMISSO=Object.freeze(['bill','card']);
export const MAX_COMPROMISSOS=1000;
export {validarCompromisso} from './validacao.js';

export function avancarMesCompromisso(mes,diferenca){
  if(typeof mes!=='string'||!MES.test(mes)||!Number.isSafeInteger(diferenca)||Math.abs(diferenca)>240)return null;
  const [ano,numero]=mes.split('-').map(Number);
  const data=new Date(Date.UTC(ano,numero-1+diferenca,1));
  const resultado=`${data.getUTCFullYear()}-${String(data.getUTCMonth()+1).padStart(2,'0')}`;
  return MES.test(resultado)?resultado:null;
}

export function indiceMesCompromisso(inicial,atual){
  if(!MES.test(String(inicial))||!MES.test(String(atual)))return null;
  const [ano,mes]=inicial.split('-').map(Number),[anoAtual,mesAtual]=atual.split('-').map(Number);
  return (anoAtual-ano)*12+mesAtual-mes;
}

export function ocorrenciaCompromisso(plano,mes){
  const indice=indiceMesCompromisso(plano?.startMonth,mes);
  if(indice===null||indice<0||(plano.monthsCount!==null&&indice>=plano.monthsCount))return null;
  const [ano,numero]=mes.split('-').map(Number);
  const ultimoDia=new Date(Date.UTC(ano,numero,0)).getUTCDate();
  const data=`${mes}-${String(Math.min(plano.day,ultimoDia)).padStart(2,'0')}`;
  return {id:plano.id,kind:plano.kind,name:plano.name,category:plano.category,
    amount:plano.amount,month:mes,date:data,parcela:indice+1,totalParcelas:plano.monthsCount};
}

export function pagamentoRegistrado(transacoes,id,mes){
  return (Array.isArray(transacoes)?transacoes:[]).find(t=>t.type==='expense'&&t.commitmentId===id&&t.commitmentMonth===mes)||null;
}

export function listarCompromissosNoMes(dados,mes,hojeISO){
  if(!MES.test(String(mes)))return [];
  return (dados?.commitments||[]).map(plano=>{
    const ocorrencia=ocorrenciaCompromisso(plano,mes);
    if(!ocorrencia)return null;
    const transacao=pagamentoRegistrado(dados?.transactions,plano.id,mes);
    return {...ocorrencia,paid:!!transacao,transactionId:transacao?.id||'',
      overdue:!transacao&&validarDataISO(hojeISO)&&ocorrencia.date<hojeISO};
  }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
}

export function registrarPagamentoCompromisso(dados,planoId,mes,{id,date,createdAt}){
  const plano=(dados?.commitments||[]).find(item=>item.id===planoId);
  if(!plano||!id||typeof id!=='string'||id.length>200||!validarDataISO(date)||!MES.test(String(mes))||
    pagamentoRegistrado(dados.transactions,planoId,mes))throw Error('Compromisso já pago ou inválido.');
  const ocorrencia=ocorrenciaCompromisso(plano,mes);
  if(!ocorrencia||!Array.isArray(dados.transactions)||dados.transactions.some(t=>t.id===id))throw Error('Ocorrência indisponível.');
  const descricao=plano.kind==='card'?`${plano.name} · parcela ${ocorrencia.parcela}/${plano.monthsCount}`:plano.name;
  return {...dados,transactions:[...dados.transactions,{id,type:'expense',description:descricao.slice(0,80),
    amount:plano.amount,date,category:plano.category,recurring:false,createdAt:createdAt||`${date}T12:00:00.000Z`,
    commitmentId:plano.id,commitmentMonth:mes}]};
}

export function resumirCartao(dados,mesAtual){
  const compromissos=(dados?.commitments||[]).filter(p=>p.kind==='card');
  const proximoMes=avancarMesCompromisso(mesAtual,1);
  const centavos=valor=>Math.round(valor*100);
  let proximaFatura=0,restante=0,parcelas=0;
  for(const plano of compromissos){
    for(let n=0;n<plano.monthsCount;n++){
      const mes=avancarMesCompromisso(plano.startMonth,n);
      if(!mes)continue;
      if(!pagamentoRegistrado(dados.transactions,plano.id,mes)){
        restante+=centavos(plano.amount);parcelas++;
        if(mes===proximoMes)proximaFatura+=centavos(plano.amount);
      }
    }
  }
  return {proximaFatura:proximaFatura/100,restante:restante/100,parcelas};
}
