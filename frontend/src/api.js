// Chamadas ao backend Flask. Os nomes dos campos são os mesmos que app.py lê em
// _extrair_params / analisar_csv — não renomear sem mudar o Python junto.

// Configuração inicial do mapa (mesmos padrões da tela antiga)
export const CONFIG_INICIAL = {
  // Dados
  nivel: 'municipio',
  focoUf: '',
  focoRegiao: '',
  colGeo: '',
  colValor: '',
  agregacao: 'sum',
  // Aparência
  tipoViz: 'calorico',
  paleta: 'Blues',
  escalaCor: 'linear',
  catCores: {},
  // Linhas
  showMun: false, espMun: 0.3, corMun: 'black',
  showUf: false, espUf: 0.8, corUf: 'black',
  showReg: false, espReg: 1.5, corReg: 'black',
  semDadoHachura: true,
  corSemDado: '#d9d9d9',
  corHachura: '#999999',
  // Legenda
  tipoLegenda: 'Sem legenda',
  orientLeg: 'vertical',
  locLeg: 'lower right',
  kLegenda: 5,
  legLabels: {},
  tituloLegAtivo: true,
  tituloLeg: '',
  legFonte: 'DejaVu Sans',
  legTam: 9,
  // Título
  tituloAtivo: false,
  tituloTexto: 'Mapa temático do Brasil',
  tituloFonte: 'DejaVu Sans',
  tituloTam: 16,
  negrito: false,
  italico: false,
  sublinhado: false,
  tituloHa: 'center',
  tituloX: 0.5,
  tituloY: 1.02,
  // Saída
  tipoMapa: 'figura',
  tileLayer: 'urbano',
};

function montarFormData(arquivo, aba, c, extras = {}) {
  const fd = new FormData();
  const campos = {
    exportar: 'false',
    palette: c.paleta,
    show_mun: c.showMun, esp_mun: c.espMun, cor_mun: c.corMun,
    show_uf: c.showUf, esp_uf: c.espUf, cor_uf: c.corUf,
    show_reg: c.showReg, esp_reg: c.espReg, cor_reg: c.corReg,
    sem_dado_hachura: c.semDadoHachura,
    cor_sem_dado: c.corSemDado,
    cor_hachura: c.corHachura,
    escala_cor: c.escalaCor,
    tipo_viz: c.tipoViz,
    titulo_ativo: c.tituloAtivo,
    titulo_texto: c.tituloTexto || 'Mapa temático do Brasil',
    titulo_fonte: c.tituloFonte,
    titulo_tam: c.tituloTam,
    titulo_negrito: c.negrito,
    titulo_italico: c.italico,
    titulo_sublinhado: c.sublinhado,
    titulo_ha: c.tituloHa,
    titulo_x: c.tituloX,
    titulo_y: c.tituloY,
    filtro_uf: c.focoUf,
    filtro_regiao: c.focoRegiao,
    tipo_legenda: c.tipoLegenda,
    orient_leg: c.orientLeg,
    loc_leg: c.locLeg,
    k_legenda: c.kLegenda,
    leg_labels: JSON.stringify(c.legLabels),
    titulo_leg_ativo: c.tituloLegAtivo,
    titulo_leg: c.tituloLeg,
    leg_fonte: c.legFonte,
    leg_tam: c.legTam,
    cat_cores: JSON.stringify(c.tipoViz === 'categorico' ? c.catCores : {}),
    arquivo,
    nivel: c.nivel,
    col_geo: c.colGeo,
    col_valor: c.colValor,
    agregacao: c.agregacao,
    ...extras,
  };
  if (aba) campos.sheet_name = aba;
  for (const [k, v] of Object.entries(campos)) {
    fd.append(k, typeof v === 'boolean' || typeof v === 'number' ? String(v) : v);
  }
  return fd;
}

async function lerJson(r) {
  try { return await r.json(); }
  catch { throw new Error(`o servidor respondeu ${r.status} sem dados`); }
}

export async function analisarArquivo(arquivo, aba) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  if (aba) fd.append('sheet_name', aba);
  const r = await fetch('/analisar-csv', { method: 'POST', body: fd });
  return lerJson(r);
}

// Retorna { imagem, avisos } (figura) ou { html } (interativo); { erro } em caso de falha
export async function gerar(arquivo, aba, config) {
  if (config.tipoMapa === 'html') {
    const fd = montarFormData(arquivo, aba, config, { tile_layer: config.tileLayer });
    return lerJson(await fetch('/gerar-mapa-html', { method: 'POST', body: fd }));
  }
  return lerJson(await fetch('/gerar-mapa', { method: 'POST', body: montarFormData(arquivo, aba, config) }));
}

// Exportação em alta resolução: o servidor devolve o arquivo (png/svg) direto
export async function exportar(arquivo, aba, config, formato) {
  const fd = montarFormData(arquivo, aba, config, { exportar: 'true', formato_export: formato });
  const r = await fetch('/gerar-mapa', { method: 'POST', body: fd });
  if (!r.ok) {
    const j = await lerJson(r);
    throw new Error(j.erro || `erro ${r.status}`);
  }
  baixarBlob(await r.blob(), `mapa_cnm.${formato}`);
}

export function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}
