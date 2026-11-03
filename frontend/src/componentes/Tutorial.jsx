// Tutorial guiado: destaca cada parte da tela e espera o usuário agir antes de avançar.
// As condições leem o estado do App (arquivo, config, resultado), não o DOM.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useState } from 'react';

const CHAVE_PULAR = 'cnm_tour_skip';

const PASSOS = [
  {
    alvo: '#uz', titulo: '📂 Passo 1 — Carregar arquivo',
    texto: 'Arraste ou clique aqui para selecionar seu arquivo CSV ou Excel.\n\nEle precisa ter pelo menos uma coluna com código IBGE e outra com os valores que deseja mapear.',
    feito: e => !!e.arquivo, espera: 'Carregue seu arquivo para continuar', ok: 'Arquivo carregado! ✓',
  },
  {
    alvo: '#fg-nivel', titulo: '🗺️ Passo 2 — Nível geográfico',
    texto: 'Escolha o nível do mapa:\n• Município — coloriza cada um dos 5.570 municípios\n• Estado — coloriza os 27 estados\n• Região — coloriza as 5 regiões do Brasil\n\nClique em um dos botões para confirmar.',
    feito: (e, nivelClicado) => nivelClicado, espera: 'Clique em Município, Estado ou Região para continuar', ok: 'Nível geográfico selecionado! ✓',
  },
  {
    alvo: '#fg-foco', titulo: '🔎 Passo 3 — Recortar por estado/região',
    texto: 'Funcionalidade opcional!\n\nSe seus dados são de um estado específico, filtre o mapa para exibir apenas aquele estado ou região.\n\nDeixe em branco para exibir o Brasil completo.',
    leitura: 2000, ok: 'Recurso opcional — clique em Próximo →',
  },
  {
    alvo: '#sel-col-geo', titulo: '🔑 Passo 4 — Coluna IBGE',
    texto: 'Selecione a coluna da planilha que contém o código IBGE:\n• 7 dígitos para município (ex: 3550308)\n• 2 dígitos para estado (ex: 35)\n\nÉ ela que conecta seus dados ao mapa.',
    feito: e => !!e.config.colGeo, espera: 'Selecione a coluna IBGE para continuar', ok: 'Coluna IBGE selecionada! ✓',
  },
  {
    alvo: '#sel-col-num', titulo: '📊 Passo 5 — O que o mapa deve mostrar',
    texto: 'Escolha qual coluna de dados será representada pelas cores do mapa.\n\nEx: população, receita, quantidade de ocorrências…',
    feito: e => !!e.config.colValor, espera: 'Selecione a coluna de valores para continuar', ok: 'Coluna de valores selecionada! ✓',
  },
  {
    alvo: '#sel-agr', titulo: '🧮 Passo 6 — Áreas repetidas na planilha',
    texto: 'Quando há várias linhas para o mesmo município, como calcular o valor final?\n\n• Somar — soma todos os valores\n• Média — calcula a média\n• Maior / menor valor — pega o extremo\n• Contar — conta as linhas\n\nPara dados únicos por município, deixe em Somar.',
    leitura: 2000, ok: 'Entendido! Clique em Próximo →',
  },
  {
    alvo: '#fg-viz', titulo: '🎨 Passo 7 — Tipo de visualização',
    texto: 'Escolha como os dados serão representados:\n\n• Calor — degradê de cores para valores numéricos\n• Categórico — uma cor diferente por categoria (ex: sim/não, 0/1, nomes)',
    leitura: 2000, ok: 'Entendido! Clique em Próximo →',
  },
  {
    alvo: '#bloco-paleta', titulo: '🌈 Passo 8 — Paleta de cores',
    texto: 'Escolha o esquema de cores e a distribuição:\n\n• Linear — escala uniforme entre min e max\n• Proporcional — destaca diferenças relativas\n• Log — útil quando há valores extremos\n\nExplore as opções para encontrar a melhor visualização.',
    leitura: 2000, ok: 'Entendido! Clique em Próximo →',
  },
  {
    alvo: '#sec-linhas', secao: 'linhas', titulo: '✏️ Passo 9 — Estilos de linha',
    texto: 'Controle as bordas desenhadas sobre o mapa:\n\n• Municípios — borda entre cada município\n• Estados — borda entre estados\n• Regiões — borda entre regiões\n\nAjuste espessura e cor, ou desmarque para ocultar cada borda.',
    leitura: 2000, ok: 'Entendido! Clique em Próximo →',
  },
  {
    alvo: '#sec-legenda', secao: 'legenda', titulo: '📋 Passo 10 — Legenda',
    texto: 'Configure como a legenda aparece no mapa:\n\n• Tipo — Contínua, Classificada ou Sem legenda\n• Classes — número de faixas de cor\n• Posição — onde a legenda será posicionada\n• Título — texto que aparece sobre a legenda',
    leitura: 2000, ok: 'Entendido! Clique em Próximo →',
  },
  {
    alvo: '#sec-titulo', secao: 'titulo', titulo: '🔤 Passo 11 — Título do mapa',
    texto: 'Adicione um título ao mapa:\n\n• Texto — o título que aparecerá acima do mapa\n• Fonte, tamanho, negrito, itálico\n• Alinhamento e posição (X/Y)\n\nDeixe em branco para gerar o mapa sem título.',
    leitura: 2000, ok: 'Entendido! Clique em Próximo →',
  },
  {
    alvo: '#bloco-saida', titulo: '💾 Passo 12 — Formato do mapa',
    texto: 'Escolha o formato do mapa gerado:\n\n• Figura — imagem PNG/SVG de alta qualidade para relatórios e apresentações\n• HTML Interativo — mapa navegável no navegador com zoom e informações ao passar o mouse (fundo Urbano ou Satélite)',
    leitura: 2000, ok: 'Entendido! Clique em Próximo →',
  },
  {
    alvo: '#btn-gerar', titulo: '🚀 Passo 13 — Gerar o mapa!',
    texto: 'Tudo configurado!\n\nClique em "Gerar mapa" para criar seu mapa com as configurações escolhidas. Depois, use os botões Baixar no topo do mapa para salvar.',
    feito: e => !!e.resultado, espera: 'Clique em "Gerar mapa" para concluir', ok: 'Mapa gerado! Tutorial concluído 🎉',
  },
];

function visivel(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

// Rola a sidebar para deixar o alvo no meio dela
function rolarAteAlvo(el) {
  const sb = document.querySelector('.sb-body');
  if (!sb || !el || !sb.contains(el)) return;
  const sr = sb.getBoundingClientRect(), er = el.getBoundingClientRect();
  sb.scrollTop = Math.max(0, sb.scrollTop + (er.top - sr.top) - sb.clientHeight / 2 + er.height / 2);
}

const Tutorial = forwardRef(function Tutorial({ estado, abrirSecao, aoConcluir }, ref) {
  const [boasVindas, setBoasVindas] = useState(false);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const [passo, setPasso] = useState(-1); // -1 = tutorial fechado
  const [lendo, setLendo] = useState(false);
  const [nivelClicado, setNivelClicado] = useState(false);
  const [pos, setPos] = useState(null); // { alvo: {l,t,r,b}, tt: {left, top} } ou { centro: true }

  useImperativeHandle(ref, () => ({ abrir: () => setBoasVindas(true) }), []);

  useEffect(() => {
    let pular = false;
    try { pular = localStorage.getItem(CHAVE_PULAR) === '1'; } catch { /* sem storage: mostra */ }
    if (pular) return;
    const t = setTimeout(() => setBoasVindas(true), 600);
    return () => clearTimeout(t);
  }, []);

  const ativo = passo >= 0;
  const p = ativo ? PASSOS[passo] : null;
  const feito = p ? (p.feito ? p.feito(estado, nivelClicado) : true) : false;

  const fechar = useCallback(() => { setPasso(-1); setPos(null); }, []);

  function guardarPreferencia() {
    if (!naoMostrar) return;
    try { localStorage.setItem(CHAVE_PULAR, '1'); } catch { /* ignora */ }
  }

  // Esc fecha boas-vindas e tutorial
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') { setBoasVindas(false); fechar(); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);

  // Passo 2 só conclui quando a pessoa clica num nível (mesmo o já marcado)
  useEffect(() => {
    if (passo !== 1) return;
    const clique = e => { if (e.target.closest?.('#fg-nivel input, #fg-nivel label')) setNivelClicado(true); };
    document.addEventListener('click', clique, true);
    return () => document.removeEventListener('click', clique, true);
  }, [passo]);

  // Passos informativos travam o "Próximo" por um instante para dar tempo de ler
  useEffect(() => {
    if (!p?.leitura) { setLendo(false); return; }
    setLendo(true);
    const t = setTimeout(() => setLendo(false), p.leitura);
    return () => clearTimeout(t);
  }, [passo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Posiciona destaque e balão; recalcula ao trocar de passo, ao redimensionar e
  // quando o estado muda (a tela pode ter mudado de altura)
  const posicionar = useCallback(() => {
    if (!p) return;
    const el = document.querySelector(p.alvo);
    if (!visivel(el)) { setPos({ centro: true }); return; }
    const r = el.getBoundingClientRect(), pad = 7;
    const alvo = {
      l: Math.max(0, r.left - pad), t: Math.max(0, r.top - pad),
      r: Math.min(innerWidth, r.right + pad), b: Math.min(innerHeight, r.bottom + pad),
    };
    const tt = document.getElementById('tour-tooltip');
    const ttW = 320, ttH = tt?.offsetHeight || 320, gap = 18, mg = 12;
    let left = r.right + gap, top = r.top + r.height / 2 - ttH / 2;
    if (left + ttW > innerWidth - mg) left = r.left - ttW - gap;
    left = Math.max(mg, Math.min(left, innerWidth - ttW - mg));
    top = Math.max(mg, Math.min(top, innerHeight - ttH - mg));
    setPos({ alvo, tt: { left, top } });
  }, [p]);

  useLayoutEffect(() => {
    if (!p) return;
    if (p.secao) abrirSecao(p.secao);
    setPos(null);
    const t = setTimeout(() => { rolarAteAlvo(document.querySelector(p.alvo)); setTimeout(posicionar, 50); }, 250);
    return () => clearTimeout(t);
  }, [passo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ativo) return;
    window.addEventListener('resize', posicionar);
    return () => window.removeEventListener('resize', posicionar);
  }, [ativo, posicionar]);

  useEffect(() => { if (ativo && pos) posicionar(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  function proximo() {
    if (!feito) return;
    if (passo < PASSOS.length - 1) setPasso(passo + 1);
    else { fechar(); aoConcluir(); }
  }

  const ultimo = passo === PASSOS.length - 1;
  const liberado = feito && !lendo;
  const bloq = pos?.alvo;

  return (
    <>
      <div id="tour-welcome" className={boasVindas ? 'show' : ''} role="dialog" aria-modal="true" aria-labelledby="tw-titulo">
        {boasVindas && (
          <div className="tw-box">
            <div className="tw-icon">🗺️</div>
            <h4 id="tw-titulo">Bem-vindo ao Sistema de Mapas CNM</h4>
            <p>Deseja ver um tutorial rápido sobre como usar o sistema? Leva menos de 1 minuto.</p>
            <label className="tw-check">
              <input type="checkbox" checked={naoMostrar} onChange={e => setNaoMostrar(e.target.checked)} />
              Não mostrar novamente
            </label>
            <div className="tw-btns">
              <button type="button" className="tw-btn-yes" autoFocus onClick={() => {
                guardarPreferencia(); setBoasVindas(false); setNivelClicado(false); setPasso(0);
              }}>
                <i className="bi bi-play-fill"></i> Sim, ver tutorial
              </button>
              <button type="button" className="tw-btn-no" onClick={() => { guardarPreferencia(); setBoasVindas(false); }}>
                Não, obrigado
              </button>
            </div>
          </div>
        )}
      </div>

      {ativo && bloq && (
        <>
          <div className="tour-blocker show" style={{ left: 0, top: 0, width: innerWidth, height: bloq.t }} />
          <div className="tour-blocker show" style={{ left: 0, top: bloq.b, width: innerWidth, height: innerHeight - bloq.b }} />
          <div className="tour-blocker show" style={{ left: 0, top: bloq.t, width: bloq.l, height: bloq.b - bloq.t }} />
          <div className="tour-blocker show" style={{ left: bloq.r, top: bloq.t, width: innerWidth - bloq.r, height: bloq.b - bloq.t }} />
          <div id="tour-highlight" className="show"
            style={{ left: bloq.l, top: bloq.t, width: bloq.r - bloq.l, height: bloq.b - bloq.t }} />
        </>
      )}

      {ativo && (
        <div
          id="tour-tooltip" className={pos ? 'show' : ''} role="dialog" aria-label={p.titulo}
          style={pos?.centro ? { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }
            : pos ? { left: pos.tt.left, top: pos.tt.top } : { visibility: 'hidden', display: 'block' }}
        >
          <div className="tour-tt-count">Passo {passo + 1} de {PASSOS.length}</div>
          <div className="tour-tt-title">{p.titulo}</div>
          <div className="tour-tt-text">{p.texto}</div>
          {(feito ? p.ok : p.espera) && (
            <div className={'tour-tt-status ' + (feito ? 'done' : 'waiting')}>
              <span>{feito ? '✅' : '⏳'}</span><span>{feito ? p.ok : p.espera}</span>
            </div>
          )}
          <div className="tour-tt-btns">
            {passo > 0 && <button type="button" className="tour-btn-prev" onClick={() => setPasso(passo - 1)}>← Anterior</button>}
            <button type="button" className="tour-btn-next" disabled={!liberado} onClick={proximo}>
              {lendo ? '⏳ Leia…' : ultimo ? (feito ? 'Concluir ✓' : 'Aguardando…') : 'Próximo →'}
            </button>
            <button type="button" className="tour-btn-skip" onClick={fechar}>Pular</button>
          </div>
          <div className="tw-progress">
            {PASSOS.map((_, i) => <div key={i} className={'tw-dot' + (i <= passo ? ' active' : '')} />)}
          </div>
        </div>
      )}
    </>
  );
});

export default Tutorial;
