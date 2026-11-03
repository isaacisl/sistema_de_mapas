// Modais de ajuda. O conteúdo de cada um é HTML estático do próprio sistema
// (src/ajuda/*.html, extraído da tela antiga), então pode ir por innerHTML.
import { useEffect, useRef } from 'react';
import meta from '../ajuda/meta.json';
import csv from '../ajuda/csv.html?raw';
import calc from '../ajuda/calc.html?raw';
import viz from '../ajuda/viz.html?raw';
import escala from '../ajuda/escala.html?raw';
import paleta from '../ajuda/paleta.html?raw';
import col from '../ajuda/col.html?raw';

const CONTEUDO = { csv, calc, viz, escala, paleta, col };

// "max-width:580px;background:x" → { maxWidth: '580px', background: 'x' }
function estiloDeTexto(txt) {
  const obj = {};
  for (const parte of (txt || '').split(';')) {
    const [k, ...v] = parte.split(':');
    if (!k.trim() || !v.length) continue;
    obj[k.trim().replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = v.join(':').trim();
  }
  return obj;
}

export default function ModalAjuda({ qual, aoFechar }) {
  const fecharRef = useRef(null);
  useEffect(() => { if (qual) fecharRef.current?.focus(); }, [qual]);
  if (!qual) return null;
  const m = meta[qual];
  return (
    <div
      id={`${qual}-help-modal`} className="show" role="dialog" aria-modal="true" aria-labelledby="modal-ajuda-titulo"
      onClick={e => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <div className="csv-mbox" style={estiloDeTexto(m.estiloCaixa)}>
        <div className="csv-mhd" style={estiloDeTexto(m.estiloCabecalho)}>
          <h6 id="modal-ajuda-titulo"><i className={`${m.icone} me-2`}></i>{m.titulo}</h6>
          <button ref={fecharRef} type="button" className="csv-mclose" aria-label="Fechar" onClick={aoFechar}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="csv-mbody" dangerouslySetInnerHTML={{ __html: CONTEUDO[qual] }} />
      </div>
    </div>
  );
}
