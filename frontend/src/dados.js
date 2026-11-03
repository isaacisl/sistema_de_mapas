// Dados fixos da interface: paletas, cores, fontes e listas geográficas.

export const PALETAS = [
  { id: 'Blues', nome: 'Azul', cores: ['#eff3ff', '#bdd7e7', '#6baed6', '#2171b5', '#084594'] },
  { id: 'Reds', nome: 'Vermelho', cores: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'] },
  { id: 'Greens', nome: 'Verde', cores: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'] },
  { id: 'Oranges', nome: 'Laranja', cores: ['#fff5eb', '#fdd0a2', '#fdae6b', '#e6550d', '#a63603'] },
  { id: 'Purples', nome: 'Roxo', cores: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'] },
  { id: 'YlOrRd', nome: 'Amarelo → Vermelho', cores: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'] },
  { id: 'YlGnBu', nome: 'Amarelo → Azul', cores: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'] },
  { id: 'RdPu', nome: 'Vermelho → Roxo', cores: ['#feebe2', '#fbb4b9', '#f768a1', '#c51b8a', '#7a0177'] },
  { id: 'viridis', nome: 'Viridis', cores: ['#440154', '#31688e', '#35b779', '#fde725', '#fde725'] },
  { id: 'plasma', nome: 'Plasma', cores: ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'] },
  { id: 'coolwarm', nome: 'Frio → Quente', cores: ['#3b4cc0', '#6688ee', '#dddddd', '#ee8866', '#b40426'] },
  { id: 'RdYlGn', nome: 'Vermelho → Verde', cores: ['#d73027', '#fc8d59', '#fee08b', '#91cf60', '#1a9850'] },
];

// Cores de borda (municípios, UF, região): valor enviado ao matplotlib + cor exibida.
export const CORES_LINHA = [
  { c: 'black', bg: '#111' },
  { c: '#444', bg: '#444' },
  { c: 'gray', bg: 'gray' },
  { c: '#bbb', bg: '#bbb' },
  { c: 'white', bg: '#fff', borda: '#ccc' },
  { c: 'navy', bg: 'navy' },
  { c: 'darkred', bg: 'darkred' },
];

// Paleta ampla (cor da área sem dado e da hachura)
export const CORES_AMPLA = [
  '#d9d9d9', '#ffffff', '#111111', '#003DA5', '#1a56c4',
  '#c62828', '#2e7d32', '#e65100', '#6a1b9a', '#f9a825', '#00838f',
];

export const CAT_CORES_PADRAO = [
  '#003DA5', '#e53935', '#43a047', '#fb8c00', '#8e24aa',
  '#00acc1', '#795548', '#f06292', '#26a69a', '#fdd835',
  '#546e7a', '#ef6c00', '#5c6bc0', '#66bb6a', '#ab47bc',
];

// Cor de cada categoria: a escolhida pelo usuário ou a padrão pela posição.
export function resolverCatCores(categorias, escolhidas) {
  const out = {};
  (categorias || []).forEach((cat, i) => {
    out[cat] = escolhidas[cat] || CAT_CORES_PADRAO[i % CAT_CORES_PADRAO.length];
  });
  return out;
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

export const NOMES_NIVEL = { municipio: 'município', uf: 'estado', regiao: 'região' };

// Fontes disponíveis no matplotlib do servidor
export const FONTES_TITULO = [
  { grupo: 'Padrão', fontes: ['DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'STIXGeneral'] },
  {
    grupo: 'Sem serifa', fontes: ['Arial', 'Calibri', 'Helvetica', 'Lato', 'Montserrat', 'Open Sans',
      'Poppins', 'Roboto', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Verdana'],
  },
  { grupo: 'Com serifa', fontes: ['Cambria', 'Georgia', 'Times New Roman'] },
  { grupo: 'Outros', fontes: ['Consolas', 'Courier New', 'Impact'] },
];

export const FONTES_LEGENDA = [
  { grupo: 'Padrão', fontes: ['DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'STIXGeneral'] },
  {
    grupo: 'Sem serifa', fontes: ['Arial', 'Calibri', 'Helvetica', 'Lato', 'Montserrat', 'Open Sans',
      'Roboto', 'Segoe UI', 'Verdana'],
  },
  { grupo: 'Com serifa', fontes: ['Georgia', 'Times New Roman'] },
];

export const TIPOS_LEGENDA = [
  { valor: 'Contagem', nome: 'Contagem por cor ★' },
  { valor: 'Faixa e Contagem', nome: 'Faixa + nº de municípios ★' },
  { valor: 'Natural Breaks', nome: 'Natural Breaks' },
  { valor: 'Quantiles', nome: 'Quantis' },
  { valor: 'Equal Interval', nome: 'Intervalos Iguais' },
  { valor: 'Contínua', nome: 'Contínua (barra)' },
  { valor: 'Sem legenda', nome: 'Sem legenda' },
];

export const POSICOES_LEGENDA = [
  { valor: 'lower right', nome: 'Canto inferior direito' },
  { valor: 'lower left', nome: 'Canto inferior esquerdo' },
  { valor: 'upper right', nome: 'Canto superior direito' },
  { valor: 'upper left', nome: 'Canto superior esquerdo' },
  { valor: 'center left', nome: 'Centro esquerda' },
  { valor: 'center right', nome: 'Centro direita' },
  { valor: 'lower center', nome: 'Centro inferior' },
  { valor: 'upper center', nome: 'Centro superior' },
];

// Prévia de cada tipo de legenda (exemplo ilustrativo, não usa os dados do usuário)
export const PREV_LEGENDA = {
  'Contagem': {
    visual: { tipo: 'classes', rotulos: ['412 municípios', '837 municípios', '1.024 municípios', '623 municípios', '214 municípios'] },
    titulo: 'Contagem por cor ★ (padrão)',
    desc: 'Cada cor do mapa mostra quantos municípios têm aquela cor. Você vê de imediato quantos lugares estão em cada nível, sem precisar interpretar intervalos de valores.',
    quando: '✔ Recomendado para a maioria dos casos. Intuitivo e direto.',
  },
  'Faixa e Contagem': {
    visual: {
      tipo: 'classes', rotulos: ['1–4  —  83 municípios', '5–11  —  36 municípios', '12–20  —  16 municípios',
        '21–28  —  7 municípios', '29–37  —  10 municípios'],
    },
    titulo: 'Faixa + nº de municípios ★',
    desc: 'Cada cor mostra a FAIXA de valores que representa e QUANTOS municípios estão nela, em ordem do claro (menor) ao escuro (maior). Assim dá para saber o que a cor significa e o tamanho do grupo ao mesmo tempo.',
    quando: '✔ Use quando quiser uma legenda completa: interpretável (faixa) e informativa (quantidade).',
  },
  'Contínua': {
    visual: { tipo: 'gradiente' },
    titulo: 'Barra de cor contínua',
    desc: 'Mostra uma barra com gradiente de cores. Cada ponto da barra corresponde a um valor exato.',
    quando: '✔ Use quando quiser mostrar a variação exata entre os valores.',
  },
  'Quantiles': {
    visual: { tipo: 'classes', rotulos: ['10 – 85 (20% menores)', '86 – 210', '211 – 430', '431 – 720', '721 – 1000 (20% maiores)'] },
    titulo: 'Quantis',
    desc: 'Divide os dados em grupos com o mesmo número de municípios. Ex: 5 grupos → 20% dos municípios em cada cor.',
    quando: '✔ Use quando quiser que todas as cores apareçam igualmente no mapa, independente dos valores.',
  },
  'Equal Interval': {
    visual: { tipo: 'classes', rotulos: ['10 – 208', '209 – 406', '407 – 604', '605 – 802', '803 – 1000'] },
    titulo: 'Intervalos Iguais',
    desc: 'Divide o intervalo de valores em partes iguais. Se os dados vão de 10 a 1000, cada faixa tem 198 unidades.',
    quando: '✔ Use quando os dados estiverem bem distribuídos e você quiser faixas de tamanho igual.',
  },
  'Natural Breaks': {
    visual: { tipo: 'classes', rotulos: ['10 – 45', '46 – 130', '131 – 320', '321 – 650', '651 – 1000'] },
    titulo: 'Natural Breaks (Jenks)',
    desc: 'Encontra onde os dados "pulam" naturalmente e usa esses pontos como divisão. Os grupos refletem o comportamento real dos dados.',
    quando: '✔ Use quando os dados tiverem agrupamentos naturais — é a opção mais precisa na maioria dos casos.',
  },
  'Sem legenda': {
    visual: { tipo: 'nenhum' },
    titulo: 'Sem legenda',
    desc: 'O mapa é gerado sem legenda. Útil para mapas ilustrativos ou quando a legenda será adicionada depois.',
    quando: '',
  },
};

export const CORES_PREV = ['#eff3ff', '#bdd7e7', '#6baed6', '#2171b5', '#084594'];
