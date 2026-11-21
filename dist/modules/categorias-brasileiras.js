/*
 * Catálogo único de categorias brasileiras. Mantém nomes antigos compatíveis com
 * backups e evita que uma conta apareça só no orçamento e não nos lançamentos.
 */
export const CATEGORIAS_RENDA = Object.freeze([
  'Salário base','Personal','Salário','Renda extra','Vendas','Benefícios','Outros'
]);

export const GRUPOS_DESPESA = Object.freeze([
  {titulo:'Moradia e contas da casa',categorias:[
    'Moradia','Aluguel','Financiamento imobiliário','Condomínio','IPTU',
    'Água e esgoto','Energia elétrica','Gás de cozinha','Internet','Telefone',
    'Celular e plano móvel','Manutenção da casa','Contas'
  ]},
  {titulo:'Alimentação e mercado',categorias:[
    'Alimentação','Supermercado','Feira e hortifruti','Padaria','Restaurantes',
    'Marmita e delivery'
  ]},
  {titulo:'Transporte e veículo',categorias:[
    'Transporte','Combustível','Transporte público','Aplicativos de transporte',
    'Manutenção do veículo','Seguro do veículo','IPVA','Licenciamento',
    'Estacionamento e pedágio','Financiamento de veículo'
  ]},
  {titulo:'Saúde, educação e família',categorias:[
    'Saúde','Plano de saúde','Consultas e exames','Farmácia','Educação',
    'Escola e mensalidade','Faculdade','Cursos','Material escolar','Creche',
    'Academia','Pets'
  ]},
  {titulo:'Financeiro e serviços',categorias:[
    'Cartão de crédito','Empréstimos','Financiamentos','Tarifas bancárias',
    'Juros e multas','Impostos','Seguros'
  ]},
  {titulo:'Pessoal e lazer',categorias:[
    'Lazer','Compras','Vestuário','Higiene e beleza','Streaming e assinaturas',
    'Viagens','Presentes','Doações','Outros'
  ]}
]);

export const CATEGORIAS_DESPESA = Object.freeze(
  [...new Set(GRUPOS_DESPESA.flatMap(grupo=>grupo.categorias))]
);

export const ICONES_DESPESA = Object.freeze({
  'Aluguel':'🏠','Financiamento imobiliário':'🏡','Condomínio':'🏢','IPTU':'🏠',
  'Água e esgoto':'💧','Energia elétrica':'⚡','Gás de cozinha':'🔥',
  'Celular e plano móvel':'📱','Manutenção da casa':'🔧',
  'Supermercado':'🛒','Feira e hortifruti':'🥦','Padaria':'🥖',
  'Restaurantes':'🍽️','Marmita e delivery':'🥡',
  'Combustível':'⛽','Transporte público':'🚌','Aplicativos de transporte':'🚕',
  'Manutenção do veículo':'🔧','Seguro do veículo':'🚙','IPVA':'🚗',
  'Licenciamento':'📄','Estacionamento e pedágio':'🅿️','Financiamento de veículo':'🚘',
  'Plano de saúde':'🏥','Consultas e exames':'🩺','Escola e mensalidade':'🏫',
  'Material escolar':'📚','Creche':'🧸','Academia':'🏋️','Pets':'🐾',
  'Empréstimos':'💳','Financiamentos':'🏦','Tarifas bancárias':'🏦',
  'Juros e multas':'📉','Impostos':'🧾','Seguros':'🛡️',
  'Vestuário':'👕','Higiene e beleza':'🧴','Streaming e assinaturas':'📺',
  'Viagens':'✈️','Presentes':'🎁','Doações':'💝'
});

export function renderizarOpcoesDespesas(esc) {
  return GRUPOS_DESPESA.map(grupo=>
    `<optgroup label="${esc(grupo.titulo)}">${grupo.categorias.map(nome=>
      `<option value="${esc(nome)}">${esc(nome)}</option>`).join('')}</optgroup>`
  ).join('');
}

if(typeof window!=='undefined')window.MeuDinheiroCategoriasBrasileiras=Object.freeze({
  expense:CATEGORIAS_DESPESA,groups:GRUPOS_DESPESA,icons:ICONES_DESPESA
});
