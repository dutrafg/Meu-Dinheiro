// Conversão local de extratos OFX (SGML 1.x e XML 2.x) para o importador CSV.
// Não executa XML externo nem transfere extratos para servidores.
export function identificarOfx(texto){
  return typeof texto==='string'&&(/<OFX[\s>]/i.test(texto)||/^OFXHEADER\s*:/im.test(texto));
}

export function converterOfxParaCsv(texto){
  if(!identificarOfx(texto)||texto.length>10*1024*1024)throw Error('Extrato OFX inválido ou grande demais');
  const blocos=[...texto.matchAll(/<STMTTRN\s*>([\s\S]*?)<\/STMTTRN\s*>/gi)];
  if(!blocos.length||blocos.length>20000)throw Error('OFX sem transações válidas');
  const campo=(bloco,nome)=>{
    const re=new RegExp(`<${nome}\\s*>\\s*([^<\\r\\n]+)`, 'i');
    return (re.exec(bloco)?.[1]||'').trim().replace(/&amp;/gi,'&').replace(/&lt;/gi,'<')
      .replace(/&gt;/gi,'>').replace(/&quot;/gi,'"');
  };
  const quoted=valor=>`"${String(valor??'').replace(/"/g,'""')}"`;
  const linhas=[['Data','Descrição','Histórico','Valor','ChaveImportacao'].map(quoted).join(';')];
  const vistos=new Map();
  for(const [,bloco] of blocos){
    const dataRaw=campo(bloco,'DTPOSTED');
    const match=/^(\d{4})(\d\d)(\d\d)/.exec(dataRaw);
    const valor=campo(bloco,'TRNAMT').replace(',','.');
    if(!match||!Number.isFinite(Number(valor))||Number(valor)===0||Math.abs(Number(valor))>999999999)
      throw Error('OFX contém transação inválida');
    const data=`${match[3]}/${match[2]}/${match[1]}`;
    const descricao=(campo(bloco,'NAME')||campo(bloco,'MEMO')||'Movimentação bancária').slice(0,80);
    const historico=(campo(bloco,'MEMO')||campo(bloco,'TRNTYPE')||descricao).slice(0,80);
    const fitid=campo(bloco,'FITID');
    // FITID é estável por banco; o sufixo distingue transações sem FITID.
    const base=fitid?`ofx:${fitid.slice(0,130)}`:`${data}|${valor}|${descricao}|${historico}`;
    const indice=(vistos.get(base)||0)+1;vistos.set(base,indice);
    const chave=fitid?`ofx:${fitid.slice(0,130)}`:`ofx-sem-id:${base}:${indice}`;
    linhas.push([data,descricao,historico,valor,chave].map(quoted).join(';'));
  }
  return linhas.join('\r\n');
}
