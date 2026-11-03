// Etapa 3: como colorir (calor ou categórico), paleta e distribuição das cores.
import { Pilulas, Rotulo, SeletorPaleta } from './Basicos';
import { resolverCatCores } from '../dados';

const TIPOS_VIZ = [
  { valor: 'calorico', id: 'tv-calor', rotulo: 'Calor', icone: 'bi-thermometer-half' },
  { valor: 'categorico', id: 'tv-cat', rotulo: 'Categórico', icone: 'bi-tags' },
];

const ESCALAS = [
  { valor: 'linear', id: 'ec-linear', rotulo: 'Linear' },
  { valor: 'proporcional', id: 'ec-rank', rotulo: 'Proporcional' },
  { valor: 'log', id: 'ec-log', rotulo: 'Log' },
];

export default function EtapaAparencia({ analise, config, mudar, abrirModal }) {
  const categorico = config.tipoViz === 'categorico';
  const categorias = analise?.valores_unicos?.[config.colValor];
  const cores = resolverCatCores(categorias, config.catCores);

  function mudarTipo(v) {
    // A lista de colunas muda (categórico aceita qualquer coluna, calor só numéricas):
    // mantém a coluna escolhida só se ela continuar válida.
    const lista = v === 'categorico' ? analise?.colunas : analise?.numericas;
    const colValor = lista?.includes(config.colValor) ? config.colValor : '';
    mudar({ tipoViz: v, colValor, catCores: {}, legLabels: {} });
  }

  return (
    <>
      <div className="etapa"><span className="step-num">3</span>Aparência</div>

      <div id="fg-viz" className="fg">
        <Rotulo texto="Como colorir" comoSpan aoAbrirModal={() => abrirModal('viz')} rotuloAjuda="Ajuda sobre os tipos de visualização" />
        <Pilulas nome="tipo-viz" valor={config.tipoViz} opcoes={TIPOS_VIZ} iconeEmCima aoMudar={mudarTipo} />
      </div>

      {!categorico && (
        <div className="fg" id="bloco-paleta">
          <Rotulo
            texto={<><i className="bi bi-palette me-1"></i>Paleta de cores</>} comoSpan
            aoAbrirModal={() => abrirModal('paleta')} rotuloAjuda="Ajuda sobre as paletas"
          />
          <SeletorPaleta valor={config.paleta} aoMudar={v => mudar({ paleta: v })} />
          <div style={{ marginTop: 8 }}>
            <Rotulo
              texto={<><i className="bi bi-bar-chart-steps me-1"></i>Distribuição de cores</>} comoSpan
              aoAbrirModal={() => abrirModal('escala')} rotuloAjuda="Ajuda sobre a distribuição de cores"
            />
            <div style={{ marginTop: 4 }}>
              <Pilulas nome="escala-cor" valor={config.escalaCor} opcoes={ESCALAS} aoMudar={v => mudar({ escalaCor: v })} />
            </div>
          </div>
        </div>
      )}

      {categorico && (
        <div id="bloco-cat-cores" style={{ display: 'block' }}>
          <Rotulo
            texto={<><i className="bi bi-palette2 me-1"></i>Cor por categoria</>} comoSpan estilo={{ marginBottom: 6 }}
            ajuda={<>No modo <b>Categórico</b>, cada valor único da coluna recebe uma cor distinta. Clique nas cores abaixo para personalizá-las individualmente.</>}
          />
          <div id="cat-lista" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {!categorias?.length && (
              <div id="cat-placeholder">Selecione uma coluna categórica para definir as cores.</div>
            )}
            {categorias?.map(cat => (
              <div className="cat-row" key={cat}>
                <input
                  type="color" value={cores[cat]} title={`Cor de ${cat}`} aria-label={`Cor de ${cat}`}
                  onChange={e => mudar({ catCores: { ...config.catCores, [cat]: e.target.value } })}
                />
                <span className="cat-label" title={cat}>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
