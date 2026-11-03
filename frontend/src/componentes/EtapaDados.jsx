// Etapa 2: nível geográfico, recorte, coluna IBGE, coluna de valor e agregação.
import { Pilulas, Rotulo } from './Basicos';
import { REGIOES, UFS } from '../dados';

const NIVEIS = [
  { valor: 'municipio', id: 'nv-mun', rotulo: 'Município', icone: 'bi-buildings' },
  { valor: 'uf', id: 'nv-uf', rotulo: 'Estado', icone: 'bi-map' },
  { valor: 'regiao', id: 'nv-reg', rotulo: 'Região', icone: 'bi-globe-americas' },
];

export default function EtapaDados({ analise, config, mudar, abrirModal }) {
  const etapa = <div className="etapa"><span className="step-num">2</span>Dados do mapa</div>;
  if (!analise) {
    return (
      <>
        {etapa}
        <div className="vazio-s">Escolha a planilha acima para indicar as colunas do mapa.</div>
      </>
    );
  }

  const colunasValor = config.tipoViz === 'categorico' ? analise.colunas : analise.numericas;
  const exemplos = (analise.amostra || []).map(r => r[config.colGeo]).filter(Boolean).join(', ');
  const detectada = config.colGeo && config.colGeo === analise.col_geo;

  return (
    <>
      {etapa}
      <div id="painel-analise" style={{ display: 'flex' }}>
        <div id="fg-nivel" className="fg">
          <Rotulo
            texto="Os dados são por" comoSpan
            ajuda={<>Define se o mapa será colorido por <b>município</b>, <b>estado</b> ou <b>região</b>. Selecione conforme o nível dos seus dados.</>}
          />
          <Pilulas
            nome="nivel" valor={config.nivel} opcoes={NIVEIS} iconeEmCima
            aoMudar={v => mudar({ nivel: v, focoUf: '', focoRegiao: '', showMun: false })}
          />
        </div>

        <div id="fg-foco" className="fg">
          <Rotulo
            texto={<>Mostrar só um estado ou região <span className="opc">(opcional)</span></>}
            para={config.nivel === 'regiao' ? 'sel-foco-reg' : 'sel-foco-uf'}
            ajuda="Filtra o mapa para exibir apenas um estado ou região, ocultando os demais. Útil para análises regionais."
          />
          {config.nivel === 'municipio' && (
            <>
              <select id="sel-foco-uf" className="form-select form-select-sm mt-1" value={config.focoUf}
                onChange={e => mudar({ focoUf: e.target.value, ...(e.target.value ? {} : { showMun: false }) })}>
                <option value="">— Todos os estados —</option>
                {UFS.map(uf => <option key={uf}>{uf}</option>)}
              </select>
              <div className="hint-s">Opcional: selecione um estado para mostrar só seus municípios.</div>
            </>
          )}
          {config.nivel === 'regiao' && (
            <>
              <select id="sel-foco-reg" className="form-select form-select-sm mt-1" value={config.focoRegiao}
                onChange={e => mudar({ focoRegiao: e.target.value })}>
                <option value="">— Todas as regiões —</option>
                {REGIOES.map(r => <option key={r}>{r}</option>)}
              </select>
              <div className="hint-s">Opcional: selecione uma região para focar nela.</div>
            </>
          )}
          {config.nivel === 'uf' && <div className="hint-s">No nível estado o mapa mostra o Brasil inteiro.</div>}
        </div>

        <div className="fg">
          <Rotulo
            texto="Coluna com o código IBGE" para="sel-col-geo"
            ajuda={<>Selecione a coluna da planilha que contém o <b>código IBGE</b> numérico (7 dígitos para município, 2 para estado). É ela que conecta seus dados ao mapa.</>}
          />
          <select id="sel-col-geo" className="form-select form-select-sm" value={config.colGeo}
            onChange={e => mudar({ colGeo: e.target.value })}>
            <option value="">— selecione —</option>
            {analise.colunas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div id="preview-geo" className="hint-s">
            {detectada && 'Encontrada automaticamente. '}{exemplos && `Ex: ${exemplos}`}
          </div>
        </div>

        <div className="fg">
          <Rotulo
            texto="O que o mapa deve mostrar" para="sel-col-num"
            aoAbrirModal={() => abrirModal('col')} rotuloAjuda="Ajuda sobre a coluna de dados"
          />
          <select id="sel-col-num" className="form-select form-select-sm" value={config.colValor}
            onChange={e => mudar({ colValor: e.target.value, legLabels: {}, catCores: {} })}>
            <option value="">— selecione —</option>
            {colunasValor.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="fg">
          <Rotulo
            texto="Se a área se repetir na planilha" para="sel-agr"
            aoAbrirModal={() => abrirModal('calc')} rotuloAjuda="Ver exemplos de cálculo"
          />
          <select id="sel-agr" className="form-select form-select-sm" value={config.agregacao}
            onChange={e => mudar({ agregacao: e.target.value })}>
            <option value="sum">Somar os valores</option>
            <option value="mean">Fazer a média</option>
            <option value="max">Usar o maior valor</option>
            <option value="min">Usar o menor valor</option>
            <option value="count">Contar as linhas</option>
          </select>
        </div>
      </div>
    </>
  );
}
