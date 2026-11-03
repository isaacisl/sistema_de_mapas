// Ajustes opcionais (seções recolhíveis): linhas, legenda e título do mapa.
import { useState } from 'react';
import {
  Amostras, BotaoAjuda, CorComPersonalizada, Deslizante, Pilulas, Rotulo, Secao, SelectFontes,
} from './Basicos';
import {
  CORES_AMPLA, CORES_LINHA, CORES_PREV, FONTES_LEGENDA, FONTES_TITULO, POSICOES_LEGENDA, PREV_LEGENDA, TIPOS_LEGENDA,
} from '../dados';

const ESTILO_ROTULO_LINHA = { fontSize: 12, fontWeight: 600, color: '#5a6474', cursor: 'pointer', margin: 0 };

// Uma linha de borda: checkbox + (espessura e cor quando ligada)
function ControleLinha({ id, rotulo, ajuda, ligado, espessura, cor, max, desativado, dicaDesativado, aoMudar, ultimo }) {
  const [ajudaAberta, setAjudaAberta] = useState(false);
  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-1"
        style={{ opacity: desativado ? 0.5 : 1 }} title={desativado ? dicaDesativado : ''}>
        <input type="checkbox" id={`chk-${id}`} className="form-check-input mt-0"
          checked={ligado} disabled={desativado} onChange={e => aoMudar({ ligado: e.target.checked })} />
        <label htmlFor={`chk-${id}`} style={ESTILO_ROTULO_LINHA}>{rotulo}</label>
        <BotaoAjuda className="ms-auto" ativo={ajudaAberta} rotulo={`Ajuda sobre ${rotulo}`} aoClicar={() => setAjudaAberta(a => !a)} />
      </div>
      <div className={'help-box' + (ajudaAberta ? ' show' : '')}>{ajuda}</div>
      {ligado && (
        <div id={`ctrl-${id}`}>
          <div className="mb-1">
            <Deslizante id={`rng-${id}`} min={0} max={max} passo={0.1} valor={espessura} aoMudar={v => aoMudar({ espessura: v })} />
          </div>
          <div className={ultimo ? '' : 'mb-3'}>
            <Amostras cores={CORES_LINHA} valor={cor} aoMudar={v => aoMudar({ cor: v })} />
          </div>
        </div>
      )}
    </>
  );
}

export function SecaoLinhas({ config, mudar, aberta, aoAlternar }) {
  // Linha de município só faz sentido com o mapa recortado para um estado: no Brasil
  // inteiro são ~5.570 bordas, o que só polui o mapa.
  const podeLinhaMun = config.nivel === 'municipio' && config.focoUf !== '';
  const [ajudaHachura, setAjudaHachura] = useState(false);

  return (
    <Secao
      id="sec-linhas" icone="bi-border-width" titulo="Estilos de linha" aberta={aberta} aoAlternar={aoAlternar}
      ajuda="Controla a espessura e cor das bordas desenhadas no mapa. Desmarque o checkbox para ocultar cada borda."
    >
      <ControleLinha
        id="mun" rotulo="Municípios" max={3}
        ligado={config.showMun && podeLinhaMun} espessura={config.espMun} cor={config.corMun}
        desativado={!podeLinhaMun}
        dicaDesativado="Disponível apenas ao recortar o mapa por um estado específico (evita milhares de bordas no Brasil inteiro)."
        ajuda="Borda entre municípios individuais. Espessuras menores ficam mais discretas; use 0 ou desmarque para ocultar completamente."
        aoMudar={m => mudar({
          ...('ligado' in m && { showMun: m.ligado }), ...('espessura' in m && { espMun: m.espessura }), ...('cor' in m && { corMun: m.cor }),
        })}
      />
      <ControleLinha
        id="uf" rotulo="Contorno UF" max={5}
        ligado={config.showUf} espessura={config.espUf} cor={config.corUf}
        ajuda={<>Linha que delimita as fronteiras entre <b>estados</b>. Costuma ser mais grossa que a borda dos municípios para destacar melhor as divisas.</>}
        aoMudar={m => mudar({
          ...('ligado' in m && { showUf: m.ligado }), ...('espessura' in m && { espUf: m.espessura }), ...('cor' in m && { corUf: m.cor }),
        })}
      />
      <ControleLinha
        id="reg" rotulo="Contorno região" max={6} ultimo
        ligado={config.showReg} espessura={config.espReg} cor={config.corReg}
        ajuda={<>Linha que delimita as <b>5 regiões</b> do Brasil (Norte, Nordeste, Centro-Oeste, Sudeste e Sul). Geralmente a mais grossa das três bordas.</>}
        aoMudar={m => mudar({
          ...('ligado' in m && { showReg: m.ligado }), ...('espessura' in m && { espReg: m.espessura }), ...('cor' in m && { corReg: m.cor }),
        })}
      />

      <div className="d-flex align-items-center gap-2 mb-1" style={{ marginTop: 10 }}>
        <input type="checkbox" id="chk-sem-dado-hachura" className="form-check-input mt-0"
          checked={config.semDadoHachura} onChange={e => mudar({ semDadoHachura: e.target.checked })} />
        <label htmlFor="chk-sem-dado-hachura" style={ESTILO_ROTULO_LINHA}>Hachura em áreas sem dado</label>
        <BotaoAjuda className="ms-auto" ativo={ajudaHachura} rotulo="Ajuda sobre a hachura" aoClicar={() => setAjudaHachura(a => !a)} />
      </div>
      <div className={'help-box' + (ajudaHachura ? ' show' : '')}>
        Municípios sem valor correspondente no arquivo aparecem com um padrão de linhas (///) além da cor cinza.
        Desmarque para deixá-los apenas com a cor sólida, sem o padrão.
      </div>

      <div className="two-col" style={{ marginTop: 8 }}>
        <div className="fg">
          <label>Cor da área sem dado</label>
          <CorComPersonalizada cores={CORES_AMPLA} valor={config.corSemDado} aoMudar={v => mudar({ corSemDado: v })} />
        </div>
        <div className="fg" style={{ opacity: config.semDadoHachura ? 1 : 0.4 }}>
          <label>Cor da hachura</label>
          <CorComPersonalizada cores={CORES_AMPLA} valor={config.corHachura} aoMudar={v => mudar({ corHachura: v })} />
        </div>
      </div>
    </Secao>
  );
}

function PreviaLegenda({ tipo }) {
  const info = PREV_LEGENDA[tipo] || PREV_LEGENDA['Contínua'];
  const v = info.visual;
  return (
    <div id="preview-legenda"
      style={{ marginTop: 10, background: '#f7f9fc', border: '1px solid #e3e9f3', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ marginBottom: 7 }}>
        {v.tipo === 'gradiente' && (
          <>
            <div style={{ height: 14, borderRadius: 4, background: `linear-gradient(to right,${CORES_PREV[0]},${CORES_PREV[4]})`, marginBottom: 4 }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#78909c' }}>
              {['10', '250', '500', '750', '1000'].map(n => <span key={n}>{n}</span>)}
            </div>
          </>
        )}
        {v.tipo === 'classes' && CORES_PREV.map((c, i) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 16, height: 16, background: c, borderRadius: 3, flexShrink: 0, border: '1px solid #ccc' }}></span>
            <span style={{ fontSize: 10, color: '#5a6474', whiteSpace: 'pre' }}>{v.rotulos[i]}</span>
          </div>
        ))}
        {v.tipo === 'nenhum' && <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 22, opacity: .3 }}>🚫</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', marginBottom: 3 }}>{info.titulo}</div>
      <div style={{ fontSize: 11, color: '#5a6474', lineHeight: 1.5 }}>{info.desc}</div>
      {info.quando && <div style={{ fontSize: 11, color: '#003DA5', marginTop: 4, fontWeight: 600 }}>{info.quando}</div>}
    </div>
  );
}

export function SecaoLegenda({ analise, config, mudar, aberta, aoAlternar }) {
  const sem = config.tipoLegenda === 'Sem legenda';
  const opac = desligado => ({ opacity: desligado ? 0.4 : 1 });
  const categorias = config.tipoViz === 'categorico' ? analise?.valores_unicos?.[config.colValor] : null;
  const tituloLegLigado = !sem && config.tituloLegAtivo;

  return (
    <Secao
      id="sec-legenda" icone="bi-list-ul" titulo="Legenda" aberta={aberta} aoAlternar={aoAlternar}
      ajuda="Configura a legenda do mapa: como os valores são agrupados, quantas classes exibir e onde a legenda aparece."
    >
      <div className="two-col">
        <div className="fg">
          <Rotulo
            texto="Tipo" para="sel-tipo-leg"
            ajuda={<>
              <b>Contagem por cor ★:</b> mostra quantos municípios têm cada cor.<br />
              <b>Faixa + nº de municípios ★:</b> mostra a faixa de valores de cada cor E quantos municípios ela tem, em ordem (claro→escuro).<br />
              <b>Natural Breaks:</b> agrupa por quebras naturais nos dados.<br />
              <b>Quantis:</b> grupos com mesmo nº de municípios.<br />
              <b>Intervalos Iguais:</b> faixas de valor iguais.<br />
              <b>Contínua:</b> barra de gradiente sem divisões.
            </>}
          />
          <select id="sel-tipo-leg" className="form-select form-select-sm" value={config.tipoLegenda}
            onChange={e => mudar({ tipoLegenda: e.target.value })}>
            {TIPOS_LEGENDA.map(t => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
          </select>
        </div>
        <div className="fg" style={opac(sem)}>
          <label htmlFor="sel-orient-leg">Orientação</label>
          <select id="sel-orient-leg" className="form-select form-select-sm" value={config.orientLeg} disabled={sem}
            onChange={e => mudar({ orientLeg: e.target.value })}>
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
      </div>

      <div className="fg" style={{ marginTop: 6, ...opac(sem) }}>
        <label htmlFor="sel-loc-leg">Posição da legenda <span className="opc">(opcional)</span></label>
        <select id="sel-loc-leg" className="form-select form-select-sm" value={config.locLeg} disabled={sem}
          onChange={e => mudar({ locLeg: e.target.value })}>
          {POSICOES_LEGENDA.map(p => <option key={p.valor} value={p.valor}>{p.nome}</option>)}
        </select>
      </div>

      {categorias?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6474' }}>Renomear rótulos</label>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {categorias.map(v => (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span title={v} style={{
                  flex: '0 0 auto', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 11, color: '#5a6474', border: '1px solid #dde3ec', borderRadius: 4, padding: '2px 6px', background: '#f7f9fc',
                }}>{v}</span>
                <span style={{ flex: '0 0 auto', color: '#b0b8c9', fontSize: 13 }} aria-hidden="true">→</span>
                <input
                  type="text" className="form-control form-control-sm" placeholder={v} aria-label={`Novo rótulo para ${v}`}
                  style={{ flex: 1, fontSize: 12 }} value={config.legLabels[v] || ''}
                  onChange={e => {
                    const legLabels = { ...config.legLabels };
                    const novo = e.target.value;
                    if (novo.trim() && novo.trim() !== v) legLabels[v] = novo; else delete legLabels[v];
                    mudar({ legLabels });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <PreviaLegenda tipo={config.tipoLegenda} />

      <div className="d-flex align-items-center gap-2 mb-1" style={{ marginTop: 8, ...opac(sem) }}>
        <input type="checkbox" id="chk-titulo-leg-ativo" className="form-check-input mt-0" disabled={sem}
          checked={config.tituloLegAtivo} onChange={e => mudar({ tituloLegAtivo: e.target.checked })} />
        <label htmlFor="chk-titulo-leg-ativo" style={{ fontSize: 12, margin: 0, cursor: 'pointer' }}>Mostrar título da legenda</label>
      </div>
      <div className="fg" style={opac(!tituloLegLigado)}>
        <label htmlFor="inp-titulo-leg">Título da legenda</label>
        <input type="text" id="inp-titulo-leg" className="form-control form-control-sm" placeholder="Ex: Nº de ocorrências"
          disabled={sem} value={config.tituloLeg} onChange={e => mudar({ tituloLeg: e.target.value })} />
      </div>
      <div className="two-col" style={{ marginTop: 8, ...opac(!tituloLegLigado) }}>
        <div className="fg">
          <label htmlFor="sel-fonte-leg">Fonte da legenda</label>
          <SelectFontes id="sel-fonte-leg" grupos={FONTES_LEGENDA} valor={config.legFonte} desativado={!tituloLegLigado}
            aoMudar={v => mudar({ legFonte: v })} />
        </div>
        <div className="fg">
          <label htmlFor="inp-tam-leg">Tamanho</label>
          <input type="number" id="inp-tam-leg" className="form-control form-control-sm" min={6} max={24}
            disabled={!tituloLegLigado} value={config.legTam} onChange={e => mudar({ legTam: e.target.value })} />
        </div>
      </div>
    </Secao>
  );
}

const ALINHAMENTOS = [
  { valor: 'left', id: 'ha-left', rotulo: 'Esquerda', x: 0.05 },
  { valor: 'center', id: 'ha-center', rotulo: 'Centro', x: 0.5 },
  { valor: 'right', id: 'ha-right', rotulo: 'Direita', x: 0.95 },
];

export function SecaoTitulo({ config, mudar, aberta, aoAlternar }) {
  return (
    <Secao
      id="sec-titulo" icone="bi-fonts" titulo="Título do mapa" aberta={aberta} aoAlternar={aoAlternar}
      ajuda={<>Texto que aparece acima do mapa. Use <b>Posição X/Y</b> para ajustar o posicionamento: X=0 é esquerda, X=1 é direita; Y acima de 1 fica acima do mapa.</>}
    >
      <div className="d-flex align-items-center gap-2 mb-2">
        <input type="checkbox" id="chk-titulo-ativo" className="form-check-input mt-0"
          checked={config.tituloAtivo} onChange={e => mudar({ tituloAtivo: e.target.checked })} />
        <label htmlFor="chk-titulo-ativo" style={{ fontSize: 12, margin: 0, cursor: 'pointer' }}>Mostrar título do mapa</label>
      </div>
      <div id="ctrl-titulo" style={{ opacity: config.tituloAtivo ? 1 : 0.4 }}>
        <div className="fg mb-2">
          <label htmlFor="inp-titulo">Texto</label>
          <input type="text" id="inp-titulo" className="form-control form-control-sm" value={config.tituloTexto}
            onChange={e => mudar({ tituloTexto: e.target.value })} />
        </div>
        <div className="two-col mb-2">
          <div className="fg">
            <label htmlFor="sel-fonte">Fonte</label>
            <SelectFontes id="sel-fonte" grupos={FONTES_TITULO} valor={config.tituloFonte} aoMudar={v => mudar({ tituloFonte: v })} />
          </div>
          <div className="fg">
            <label htmlFor="inp-tam-titulo">Tamanho</label>
            <input type="number" id="inp-tam-titulo" className="form-control form-control-sm" min={6} max={60}
              value={config.tituloTam} onChange={e => mudar({ tituloTam: e.target.value })} />
          </div>
        </div>
        <div className="d-flex gap-3 mb-2">
          {[['negrito', 'Negrito'], ['italico', 'Itálico'], ['sublinhado', 'Sublinhado']].map(([campo, nome]) => (
            <div className="form-check" key={campo}>
              <input className="form-check-input" type="checkbox" id={`chk-${campo}`}
                checked={config[campo]} onChange={e => mudar({ [campo]: e.target.checked })} />
              <label className="form-check-label" htmlFor={`chk-${campo}`} style={{ fontSize: 12 }}>{nome}</label>
            </div>
          ))}
        </div>
        <div className="fg mb-2">
          <span className="lbl-s">Alinhamento</span>
          <Pilulas nome="titulo-ha" valor={config.tituloHa} opcoes={ALINHAMENTOS}
            aoMudar={v => mudar({ tituloHa: v, tituloX: ALINHAMENTOS.find(a => a.valor === v).x })} />
        </div>
        <div className="two-col">
          <div className="fg">
            <label htmlFor="rng-tx">Posição X <span className="opc">(0–1)</span></label>
            <Deslizante id="rng-tx" min={0} max={1} passo={0.01} casas={2} valor={config.tituloX} aoMudar={v => mudar({ tituloX: v })} />
          </div>
          <div className="fg">
            <label htmlFor="rng-ty">Posição Y</label>
            <Deslizante id="rng-ty" min={0.8} max={1.3} passo={0.01} casas={2} valor={config.tituloY} aoMudar={v => mudar({ tituloY: v })} />
          </div>
        </div>
      </div>
    </Secao>
  );
}
