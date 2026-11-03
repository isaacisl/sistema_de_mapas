// Rodapé fixo da sidebar: formato de saída, fundo (HTML) e o botão Gerar mapa,
// com uma linha que diz o que ainda falta preencher.
import { Pilulas, Rotulo } from './Basicos';

const FORMATOS = [
  { valor: 'figura', id: 'tm-figura', rotulo: 'Figura', icone: 'bi-image' },
  { valor: 'html', id: 'tm-html', rotulo: 'HTML interativo', icone: 'bi-globe2' },
];
const FUNDOS = [
  { valor: 'urbano', id: 'tl-urbano', rotulo: 'Urbano', icone: 'bi-map' },
  { valor: 'satelite', id: 'tl-satelite', rotulo: 'Satélite', icone: 'bi-satellite' },
];

export function oQueFalta(arquivo, config) {
  if (!arquivo) return 'Comece escolhendo a planilha (etapa 1).';
  if (!config.colGeo) return 'Falta a coluna com o código IBGE (etapa 2).';
  if (!config.colValor) return 'Falta escolher o que o mapa deve mostrar (etapa 2).';
  return null;
}

export default function RodapeGerar({ arquivo, config, mudar, gerando, aoGerar }) {
  const falta = oQueFalta(arquivo, config);
  return (
    <div id="sb-acoes">
      <div id="bloco-saida">
        <Rotulo
          texto="Formato do mapa" comoSpan rotuloAjuda="Ajuda sobre o formato" estilo={{ marginBottom: 5 }}
          ajuda={<><b>Figura</b> gera uma imagem estática (PNG/SVG) de alta qualidade, ideal para relatórios e apresentações.<br /><br /><b>HTML Interativo</b> cria um mapa navegável no navegador, com zoom e tooltips ao passar o mouse.</>}
        />
        <Pilulas nome="tipo-mapa" valor={config.tipoMapa} opcoes={FORMATOS} aoMudar={v => mudar({ tipoMapa: v })} />
      </div>

      {config.tipoMapa === 'html' && (
        <div id="bloco-tile">
          <span className="lbl-s">Fundo do mapa</span>
          <Pilulas nome="tile-layer" valor={config.tileLayer} opcoes={FUNDOS} aoMudar={v => mudar({ tileLayer: v })} />
        </div>
      )}

      <button id="btn-gerar" type="button" onClick={aoGerar} disabled={gerando} title="Atalho: Ctrl + Enter">
        {gerando
          ? <><span className="spinner-border spinner-border-sm me-2"></span>Gerando…</>
          : <><i className="bi bi-map-fill"></i> Gerar mapa</>}
      </button>
      <div id="status-pronto" className={falta ? '' : 'ok'} aria-live="polite">
        {falta
          ? <><i className="bi bi-info-circle"></i><span>{falta}</span></>
          : <><i className="bi bi-check-circle-fill"></i><span>Tudo pronto para gerar o mapa.</span></>}
      </div>
    </div>
  );
}
