/* Importação local de CSV, incluindo extratos com preâmbulo e saldo por linha. */
(function (root) {
  'use strict';
  function norm(value) {
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  }
  function parseRows(text,separator) {
    const rows=[];let row=[],field='',quoted=false;
    const source=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<source.length;i++) {
      const c=source[i];
      if(c==='"') {if(quoted&&source[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
      else if(c===separator&&!quoted){row.push(field);field='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(s=>s.trim()))rows.push(row);row=[];field='';}
      else field+=c;
      if(rows.length>25000)throw Error('CSV com mais de 25 mil linhas.');
    }
    if(quoted)throw Error('CSV com aspas não fechadas.');
    row.push(field);if(row.some(s=>s.trim()))rows.push(row);
    return rows;
  }
  const ALIASES={
    date:['data','datalancamento','datamovimentacao','datatransacao','dataoperacao','date'],
    description:['descricao','descricaooperacao','detalhes','estabelecimento','favorecido','description','memo'],
    history:['historico','historicolancamento','observacao'],
    amount:['valor','valorrs','valorlancamento','valortransacao','amount','quantia'],
    credit:['credito','creditos','valorcredito','entrada','entradas'],
    debit:['debito','debitos','valordebito','saida','saidas'],
    type:['tipo','tipotransacao','natureza','operacao','entradaesaida'],
    category:['categoria','category'],recurring:['recorrente','repetir'],
    id:['id'],importKey:['chaveimportacao','chaveorigem'],balance:['saldo','saldofinal','saldoconta']
  };
  function fieldsFor(header) {
    const names=header.map(norm),mapping={};
    for(const [key,aliases] of Object.entries(ALIASES))mapping[key]=names.findIndex(n=>aliases.includes(n));
    return mapping;
  }
  function findHeader(text) {
    for(const delimiter of [';',',','\t']) {
      const rows=parseRows(text,delimiter);
      for(let i=0;i<Math.min(30,rows.length);i++) {
        const fields=fieldsFor(rows[i]);
        if(fields.date>=0&&(fields.amount>=0||fields.credit>=0||fields.debit>=0))return {rows,fields,headerLine:i+1,delimiter};
      }
    }
    throw Error('Não encontrei as colunas Data e Valor. Envie o CSV para adaptar o formato.');
  }
  function moneyNumber(value) {
    let s=String(value??'').trim();if(!s)return null;
    let negative=false;
    if(/^\(.*\)$/.test(s)){negative=true;s=s.slice(1,-1);}
    s=s.replace(/R\$/gi,'').replace(/[\s\u00a0]/g,'').replace(/\u2212/g,'-');
    if(!/^[+-]?[0-9.,]+$/.test(s))return null;
    if(s.startsWith('-'))negative=!negative;
    s=s.replace(/^[+-]/,'');
    const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
    const dec=Math.max(comma,dot);
    if(dec>=0){
      const digitsAfter=s.length-dec-1;
      if(digitsAfter===1||digitsAfter===2){const sep=s[dec];s=s.slice(0,dec).replace(/[.,]/g,'')+'.'+s.slice(dec+1);}
      else s=s.replace(/[.,]/g,'');
    }
    const num=Number(s);return Number.isFinite(num)?(negative?-num:num):null;
  }
  function iso(value) {
    const s=String(value||'').trim();let year,month,day;
    let m=s.match(/^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$/);
    if(m){day=+m[1];month=+m[2];year=+m[3];}
    else {m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);if(!m)return null;year=+m[1];month=+m[2];day=+m[3];}
    const date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||year<2000||year>2100)return null;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function guessCategory(type,description,available) {
    const x=norm(description);let name='Outros';
    const palavras=String(description||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(type==='income') {if(/salario|pagamentoempreg|folhadepag/.test(x))name='Salário';else if(/freelan|servico|honorario/.test(x))name='Renda extra';}
    else if(/internet|provedorinternet|fibraotica|bandalarga|wifiresidencial/.test(x))name='Internet';
    else if(/telefone|telefonia|recargacelular|contacelular|planomovel/.test(x))name='Telefone';
    else if(/cartaodecredito|faturacartao|faturacredito|pagamentofatura|pgtocartao|pgtfatura/.test(x))name='Cartão de crédito';
    else if(/faculdade|universidad|mensalidadefacul|centrouniversitario/.test(x))name='Faculdade';
    else if(/farmac|drogaria|drogasil|drogaraia/.test(x))name='Farmácia';
    else if(/(?:^| )cursos?(?: |$)|(?:^| )cursinho(?: |$)/.test(palavras)||/treinamento|capacitacao|udemy|alura/.test(x))name='Cursos';
    else if(/supermerc|aliment|padaria|restaur|ifood|lanch|acougue|hortifrut|feira/.test(x)||
      (/(?:^| )mercados?(?: |$)/.test(palavras)&&!/(?:^| )mercado pago(?: |$)/.test(palavras)))name='Alimentação';
    else if(/clinica|hospital|medic/.test(x))name='Saúde';
    else if(/uber|combust|pedagio|transporte|estacionamento/.test(x)||/(?:^| )posto(?: |$)/.test(palavras))name='Transporte';
    else if(/faculdade|escola|curso|ensino|educac/.test(x))name='Educação';
    else if(/aluguel|condominio|imobiliaria/.test(x))name='Moradia';
    else if(/energia|saneamento|telefone|internet|assinatura|netflix|fatura|contadeagua|contadeluz/.test(x))name='Contas';
    else if(/cinema|show|lazer|parque/.test(x))name='Lazer';
    // Extratos com listas antigas podem não ter as categorias específicas.
    // Nesses casos, preservamos a categoria geral mais próxima antes de "Outros".
    const gerais={'Internet':'Contas','Telefone':'Contas','Cartão de crédito':'Contas',
      'Faculdade':'Educação','Farmácia':'Saúde','Cursos':'Educação'};
    if(available.includes(name))return name;
    if(gerais[name]&&available.includes(gerais[name]))return gerais[name];
    return available.includes('Outros')?'Outros':available[0];
  }
  function fingerprint(parts) {
    const str=parts.map(v=>String(v||'').trim().toLowerCase()).join('|');
    let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
    return 'csv:'+String(h>>>0).padStart(10,'0');
  }
  function importCSV(text,categories) {
    const {rows,fields,headerLine,delimiter}=findHeader(text);
    const items=[];const issues=[];const seen=new Map();let skipped=0;
    const field=(row,key)=>fields[key]<0?'':String(row[fields[key]]??'').trim();
    for(let i=headerLine;i<rows.length;i++) {
      const row=rows[i];const date=iso(field(row,'date'));
      if(!date){skipped++;if(issues.length<5)issues.push(`Linha ${i+1}: data não reconhecida.`);continue;}
      const credit=moneyNumber(field(row,'credit')),debit=moneyNumber(field(row,'debit'));
      let amount=moneyNumber(field(row,'amount'));
      if(amount===null)amount=credit!==null&&credit!==0?Math.abs(credit):debit!==null&&debit!==0?-Math.abs(debit):null;
      if(amount===null||amount===0||Math.abs(amount)>999999999){skipped++;if(issues.length<5)issues.push(`Linha ${i+1}: valor inválido.`);continue;}
      const typeText=norm(field(row,'type'));
      const creditoPositivo=credit!==null&&credit>0&&!(debit!==null&&debit>0);
      const debitoPositivo=debit!==null&&debit>0&&!(credit!==null&&credit>0);
      let type=creditoPositivo?'income':debitoPositivo?'expense':
        /(renda|credito|entrada|credit|recebimento|recebido|recebida|salario)/.test(typeText)?'income':
        /(despesa|debito|saida|debit|pagamento)/.test(typeText)?'expense':amount<0?'expense':'income';
      const history=field(row,'history'),description=field(row,'description');
      const label=history&&description&&norm(history)!==norm(description)?`${history} · ${description}`:(description||history||'Lançamento bancário');
      // Aplicação ou resgate de investimento é transferência patrimonial, não consumo.
      const investmentTransfer=/^(aplicacao|resgate)/.test(norm(history||field(row,'type')||description));
      const available=categories[type];
      const originalCategory=field(row,'category');
      const category=available.includes(originalCategory)?originalCategory:guessCategory(type,label,available);
      const originalId=field(row,'id');
      const rawKey=[date,history,description,field(row,'amount'),field(row,'credit'),field(row,'debit'),field(row,'balance')];
      const baseKey=fingerprint(rawKey);
      const occurrence=(seen.get(baseKey)||0)+1;seen.set(baseKey,occurrence);
      const importKey=field(row,'importKey')||`${baseKey}:${occurrence}`;
      const recurring=/^(sim|true|1|yes)$/i.test(field(row,'recurring'));
      items.push({id:originalId||'',type,description:label.slice(0,80),amount:Math.round(Math.abs(amount)*100)/100,date,category,recurring,importKey,investmentTransfer,allocationDelta:investmentTransfer?(amount<0?Math.abs(amount):-Math.abs(amount)):0});
    }
    if(!items.length)throw Error('Nenhum lançamento válido encontrado no CSV.');
    return {items,skipped,issues,headerLine,delimiter,total:rows.length-headerLine};
  }
  function exportCSV(transactions,allocations=[]) {
    const quote=(v,asText=false)=>{
      let s=String(v??'');
      if(asText&&/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;
      return `"${s.replace(/"/g,'""')}"`;
    };
    const header=['Data','Tipo','Descrição','Categoria','Valor','Recorrente','ID','ChaveImportacao'];
    const rows=transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[
      t.date,t.type==='income'?'Renda':'Despesa',t.description,t.category,Number(t.amount).toFixed(2).replace('.',','),t.recurring?'Sim':'Não',t.id,t.importKey||''
    ]);
    const labels={reserve:'Reserva',goal:'Meta',dream:'Sonho'};
    for(const a of allocations){
      const amount=a.amount>=0?-a.amount:Math.abs(a.amount);
      rows.push([a.date,`${a.amount>=0?'Aplicação':'Resgate'} (${labels[a.kind]||'Reserva'})`,a.description,labels[a.kind]||'Reserva',Number(amount).toFixed(2).replace('.',','),'Não',a.id,a.importKey||'']);
    }
    rows.sort((a,b)=>a[0].localeCompare(b[0]));
    return '\uFEFF'+[header,...rows].map(row=>row.map((cell,i)=>quote(cell,i===2||i===3||i===6||i===7)).join(';')).join('\r\n')+'\r\n';
  }
  const api={importCSV,exportCSV,parseRows,moneyNumber,iso};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.MeuDinheiroCSV=api;
})(typeof globalThis==='object'?globalThis:this);
