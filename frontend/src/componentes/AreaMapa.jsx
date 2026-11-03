// Lado direito: cabeçalho com o que está na tela + downloads, e o mapa (ou o estado vazio).
import { useState } from 'react';

function Avisos({ avisos }) {
  if (!avisos || (!avisos.sem_match?.length && !avisos.sem_dado?.length)) return null;
  const lista = (itens, max) => {
    const resto = itens.length - max;
    return <>{itens.slice(0, max).join(', ')}{resto > 0 && <b> e mais {resto}…</b>}</>;
  };
  const sm = avisos.sem_match || [];
  const sd = avisos.sem_dado || [];
  return (
    <div id="avisos-panel" style={{ margin: '10px 16px 0', borderRadius: 8, overflow: 'hidden', fontSize: 12 }}>
      {sm.length > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 5 }}>
            <i className="bi bi-exclamation-triangle-fill me-1"></i>
            {sm.length} código{sm.length > 1 ? 's' : ''} não encontrado{sm.length > 1 ? 's' : ''} no shapefile
          </div>
          <div style={{ color: '#5a4000', lineHeight: 1.7 }}>
            Esses valores da coluna IBGE não correspondem a nenhuma área do nível selecionado.
            Verifique se o código está correto e se o nível geográfico bate com seus dados.<br />
            <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{lista(sm, 20)}</span>
          </div>
        </div>
      )}
      {sd.length > 0 && (
        <div style={{ background: '#e8f4fd', border: '1px solid #90caf9', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontWeight: 700, color: '#1565c0', marginBottom: 5 }}>
            <i className="bi bi-info-circle-fill me-1"></i>
            {sd.length} área{sd.length > 1 ? 's' : ''} sem dado na planilha — aparecem em cinza no mapa
          </div>
          <div style={{ color: '#2d4070', lineHeight: 1.7 }}>
            <span style={{ fontSize: 11 }}>{lista(sd, 30)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const ROTULO_BAIXAR = {
  png: <><i className="bi bi-download"></i> Baixar PNG</>,
  svg: <><i className="bi bi-filetype-svg"></i> Baixar SVG</>,
};

export default function AreaMapa({ resultado, tipoMapa, temArquivo, carregando, exportando, aoBaixar, aoBaixarHtml, aoEscolherArquivo }) {
  const [zoom, setZoom] = useState(false);
  const temFigura = resultado?.tipo === 'figura';
  const temHtml = resultado?.tipo === 'html';

  const botaoBaixar = formato => (
    <button
      id={formato === 'png' ? 'btn-export' : 'btn-export-svg'} type="button"
      disabled={!temFigura || !!exportando}
      title={formato === 'png' ? 'Imagem em alta resolução (300 dpi) para relatórios' : 'Vetorial: amplia sem perder qualidade'}
      onClick={() => aoBaixar(formato)}
    >
      {exportando === formato
        ? <><span className="spinner-border spinner-border-sm me-2"></span>Exportando…</>
        : ROTULO_BAIXAR[formato]}
    </button>
  );

  return (
    <main id="ct">
      <div id="ct-head">
        <div className="ct-info">
          <h5 id="ct-titulo">{resultado?.titulo || 'Nenhum mapa gerado ainda'}</h5>
          <div id="ct-sub">{resultado?.sub || 'O mapa aparece aqui depois que você clicar em Gerar mapa.'}</div>
        </div>
        {tipoMapa === 'html' ? (
          <div id="bloco-export-html">
            <button id="btn-export-html" type="button" disabled={!temHtml} onClick={aoBaixarHtml}>
              <i className="bi bi-filetype-html"></i> Baixar HTML
            </button>
          </div>
        ) : (
          <div id="bloco-export-img">{botaoBaixar('png')}{botaoBaixar('svg')}</div>
        )}
      </div>

      <div id="map-wrap">
        {!resultado && !carregando && (
          <div id="ph">
            <div className="phi"><i className="bi bi-map"></i></div>
            <h6>Seu mapa aparece aqui</h6>
            <ol className="ph-passos">
              <li>Escolha a planilha com o código IBGE</li>
              <li>Diga o que o mapa deve mostrar</li>
              <li>Clique em <b>Gerar mapa</b></li>
            </ol>
            {!temArquivo && (
              <button id="ph-btn" type="button" onClick={aoEscolherArquivo}>
                <i className="bi bi-upload"></i> Escolher planilha
              </button>
            )}
            <p>Também dá para arrastar o arquivo para qualquer ponto da tela.</p>
          </div>
        )}

        <div id="ov" className={carregando ? 'show' : ''} aria-live="polite">
          <div className="spin"></div>
          <p id="ov-msg">{carregando || 'Processando…'}</p>
        </div>

        {temFigura && (
          <img
            id="map-img" src={resultado.imagem} alt={resultado.titulo} style={{ display: 'block' }}
            className={zoom ? 'zoomed' : ''} onClick={() => setZoom(z => !z)}
          />
        )}
        {temHtml && <iframe id="map-iframe" title="Mapa interativo" srcDoc={resultado.html} style={{ display: 'block' }} />}
        {temFigura && <Avisos avisos={resultado.avisos} />}
      </div>
    </main>
  );
}
