// Peças pequenas reaproveitadas em toda a sidebar.
import { useEffect, useId, useRef, useState } from 'react';
import { PALETAS } from '../dados';

// Rótulo + botão "?" que abre um texto de ajuda logo abaixo.
// Passe `ajuda` (conteúdo inline) ou `aoAbrirModal` (abre um modal de ajuda).
export function Rotulo({ texto, para, ajuda, aoAbrirModal, rotuloAjuda, comoSpan, estilo }) {
  const [aberto, setAberto] = useState(false);
  const Tag = comoSpan ? 'span' : 'label';
  return (
    <>
      <div className="lbl-help" style={estilo}>
        <Tag htmlFor={comoSpan ? undefined : para} className={comoSpan ? 'lbl-s' : undefined}>{texto}</Tag>
        {(ajuda || aoAbrirModal) && (
          <BotaoAjuda
            ativo={aberto}
            rotulo={rotuloAjuda}
            aoClicar={aoAbrirModal || (() => setAberto(a => !a))}
          />
        )}
      </div>
      {ajuda && <div className={'help-box' + (aberto ? ' show' : '')}>{ajuda}</div>}
    </>
  );
}

export function BotaoAjuda({ ativo, rotulo = 'Ajuda', aoClicar, className = '' }) {
  return (
    <button
      type="button"
      className={`help-btn ${className}${ativo ? ' active' : ''}`}
      aria-label={rotulo}
      aria-expanded={ativo}
      onClick={e => { e.stopPropagation(); aoClicar(); }}
    >?</button>
  );
}

// Grupo de botões de opção (rádio estilizado). opcoes: [{ valor, rotulo, icone }]
export function Pilulas({ nome, valor, opcoes, aoMudar, iconeEmCima = false }) {
  const base = useId();
  return (
    <div className="tipo-g" role="radiogroup">
      {opcoes.map(o => {
        const id = `${base}-${o.valor}`;
        return (
          <span key={o.valor} style={{ display: 'contents' }}>
            <input
              type="radio" name={nome} id={o.id || id} value={o.valor}
              checked={valor === o.valor} onChange={() => aoMudar(o.valor)}
            />
            <label htmlFor={o.id || id}>
              {o.icone && <i className={`bi ${o.icone}${iconeEmCima ? '' : ' me-1'}`}></i>}
              {o.icone && iconeEmCima && <br />}
              {o.rotulo}
            </label>
          </span>
        );
      })}
    </div>
  );
}

// Amostras de cor clicáveis. cores: [{ c, bg, borda }] ou lista de hex.
export function Amostras({ cores, valor, aoMudar }) {
  return (
    <div className="swatch-row">
      {cores.map(item => {
        const { c, bg, borda } = typeof item === 'string' ? { c: item, bg: item } : item;
        return (
          <button
            type="button" key={c} title={c} aria-label={`Cor ${c}`} aria-pressed={valor === c}
            className={'swatch' + (valor === c ? ' active' : '')}
            style={{ background: bg, border: borda || bg === '#ffffff' ? `2px solid ${borda || '#ccc'}` : undefined }}
            onClick={() => aoMudar(c)}
          />
        );
      })}
    </div>
  );
}

// Amostras + seletor de cor livre ("Personalizada")
export function CorComPersonalizada({ cores, valor, aoMudar, titulo }) {
  return (
    <>
      <Amostras cores={cores} valor={valor} aoMudar={aoMudar} />
      <div className="color-pick-wrap">
        <label>Personalizada</label>
        <input
          type="color" className="color-pick" title={titulo || 'Escolher cor personalizada'}
          value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : '#999999'}
          onChange={e => aoMudar(e.target.value)}
        />
      </div>
    </>
  );
}

export function BlocosPaleta({ cores }) {
  return (
    <span className="pal-blocks">
      {cores.map((c, i) => <span key={i} className="pal-block" style={{ background: c }}></span>)}
    </span>
  );
}

export function SeletorPaleta({ valor, aoMudar }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const atual = PALETAS.find(p => p.id === valor) || PALETAS[0];

  useEffect(() => {
    if (!aberto) return;
    const fechar = e => { if (!ref.current?.contains(e.target)) setAberto(false); };
    const esc = e => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('click', fechar);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', fechar); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  return (
    <div className="pal-picker" ref={ref}>
      <div
        className="pal-selected" id="pal-selected" tabIndex={0} role="button" aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto(a => !a)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(a => !a); } }}
      >
        <BlocosPaleta cores={atual.cores} />
        <span className="pal-label">{atual.nome}</span>
        <i className="bi bi-chevron-down" style={{ fontSize: 11, marginLeft: 'auto', color: '#78909c' }}></i>
      </div>
      <div className={'pal-drop' + (aberto ? ' open' : '')} role="listbox">
        {PALETAS.map(p => (
          <div
            key={p.id} role="option" aria-selected={p.id === valor} tabIndex={aberto ? 0 : -1}
            className={'pal-opt' + (p.id === valor ? ' active' : '')}
            onClick={() => { aoMudar(p.id); setAberto(false); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoMudar(p.id); setAberto(false); } }}
          >
            <BlocosPaleta cores={p.cores} />
            <span className="pal-nome">{p.nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Seção recolhível (Linhas, Legenda, Título). `aberta`/`aoAlternar` permitem que o
// tutorial abra a seção de fora.
export function Secao({ id, icone, titulo, ajuda, aberta, aoAlternar, children }) {
  const [ajudaAberta, setAjudaAberta] = useState(false);
  return (
    <div className={'sec-wrap' + (aberta ? ' open' : '')} id={id}>
      <div
        className="sec-toggle" role="button" tabIndex={0} aria-expanded={aberta}
        onClick={aoAlternar}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoAlternar(); }
        }}
      >
        <span><i className={`bi ${icone} me-1`}></i>{titulo}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {ajuda && <BotaoAjuda ativo={ajudaAberta} rotulo={`Ajuda sobre ${titulo.toLowerCase()}`} aoClicar={() => setAjudaAberta(a => !a)} />}
          <i className="bi bi-chevron-down chev"></i>
        </div>
      </div>
      <div className={'sec-body' + (aberta ? ' open' : '')}>
        {ajuda && <div className={'help-box' + (ajudaAberta ? ' show' : '')} style={{ marginBottom: 10 }}>{ajuda}</div>}
        {children}
      </div>
    </div>
  );
}

// Controle deslizante com o valor ao lado
export function Deslizante({ id, min, max, passo, valor, aoMudar, casas }) {
  return (
    <div className="rng-row">
      <input
        type="range" id={id} className="form-range" min={min} max={max} step={passo} value={valor}
        onChange={e => aoMudar(parseFloat(e.target.value))}
      />
      <span className="rng-val">{casas != null ? Number(valor).toFixed(casas) : valor}</span>
    </div>
  );
}

export function SelectFontes({ id, grupos, valor, aoMudar, desativado }) {
  return (
    <select id={id} className="form-select form-select-sm" value={valor} disabled={desativado}
      onChange={e => aoMudar(e.target.value)}>
      {grupos.map(g => (
        <optgroup key={g.grupo} label={g.grupo}>
          {g.fontes.map(f => <option key={f}>{f}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
