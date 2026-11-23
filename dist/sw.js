const CACHE='meu-dinheiro-essencial-v59';
const ASSETS=['./','./index.html','./styles.css','./prototype.css','./css/estrutura.css','./css/resumo.css','./css/previsoes.css','./css/relatorio-anual.css','./css/calendario.css','./css/saude.css','./css/objetivos.css','./css/investimentos.css','./css/progresso.css','./css/dialogos.css','./css/acao-rapida-mobile.css','./css/responsivo.css','./css/ajustes.css','./css/impressao.css','./csv.js','./analytics.js','./folder-backup.js','./app.js','./modules/orcamento.js','./modules/previsoes.js','./modules/relatorio-anual.js','./modules/resumo.js','./modules/calendario-financeiro.js','./modules/saude.js','./modules/notificacoes.js','./modules/relatorio-pdf-conteudo.js','./modules/relatorio-pdf.js','./modules/lancamentos.js','./modules/teclado-monetario.js','./modules/objetivos.js','./modules/dominio-objetivos.js','./modules/investimentos.js','./modules/dominio-investimentos.js','./modules/backup.js','./modules/csv-interface.js','./modules/ofx.js','./modules/validacao.js','./modules/atualizador.js','./modules/dialogos.js','./modules/diagnostico.js','./modules/diagnostico-proposta.js','./modules/integridade.js','./modules/log.js','./modules/preferencias.js','./modules/regras-financeiras.js','./modules/motor-financeiro.js','./modules/categorias-brasileiras.js','./modules/ajustes.js','./modules/acao-rapida.js','./modules/limpeza-dados.js','./modules/concorrencia-dados.js','./modules/espelho-indexeddb.js','./modules/recuperacao-conflitos.js','./modules/repositorio-financeiro.js','./modules/ciclo-periodo.js','./modules/catalogo-diagnostico.js','./modules/auditoria-codigo.js','./modules/registro-modulos.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')void self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    // Nunca retornar HTML como resposta a um JavaScript, ícone ou imagem ausente.
    if(event.request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
    return Response.error();
  }));
});
