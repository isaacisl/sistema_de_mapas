// Etapa 1: escolher a planilha (e a aba, se for Excel com várias).
import { useState } from 'react';
import { Rotulo } from './Basicos';

export default function EtapaPlanilha({ arquivo, analise, aba, inputRef, arrastando, aoEscolher, aoRemover, aoMudarAba, abrirModal }) {
  const [sobre, setSobre] = useState(false);
  const abas = analise?.abas || [];

  return (
    <>
      <div className="etapa"><span className="step-num">1</span>Planilha</div>

      <div className="fg">
        <Rotulo
          texto="Arquivo CSV ou Excel" para="inp-file"
          aoAbrirModal={() => abrirModal('csv')} rotuloAjuda="Como a planilha deve estar organizada"
        />
        <div
          id="uz" className={sobre || arrastando ? 'drag' : ''}
          onDragOver={e => { e.preventDefault(); setSobre(true); }}
          onDragLeave={() => setSobre(false)}
          onDrop={e => {
            e.preventDefault(); e.stopPropagation(); setSobre(false);
            if (e.dataTransfer.files[0]) aoEscolher(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file" id="inp-file" ref={inputRef} accept=".csv,.txt,.xlsx,.xls,.xlsm"
            onChange={e => { if (e.target.files[0]) aoEscolher(e.target.files[0]); }}
          />
          <div className="zi"><i className="bi bi-file-earmark-spreadsheet"></i></div>
          <div className="zt">
            Arraste a planilha aqui ou clique para escolher<br />
            <small style={{ opacity: .7 }}>.csv, .xlsx, .xls ou .xlsm</small>
          </div>
          <div className="zn">{arquivo?.name}</div>
        </div>

        {arquivo && (
          <button type="button" className="btn btn-sm btn-outline-secondary mt-1 w-100" onClick={aoRemover}>
            <i className="bi bi-x-circle me-1"></i>Remover arquivo
          </button>
        )}

        {abas.length > 1 && (
          <div className="fg mt-2">
            <label htmlFor="sel-aba">Aba da planilha</label>
            <select id="sel-aba" className="form-select form-select-sm" value={aba || ''}
              onChange={e => aoMudarAba(e.target.value)}>
              {abas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {analise && (
          <div style={{ marginTop: 8, background: '#f7f9fc', border: '1px solid #e3e9f3', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: '#1a2744', fontWeight: 600 }}>
              {analise.total_linhas.toLocaleString('pt-BR')} linhas · {analise.colunas.length} colunas
            </div>
            <div style={{ fontSize: 11, color: '#78909c', marginTop: 3 }}>Colunas: {analise.colunas.join(', ')}</div>
          </div>
        )}
      </div>
    </>
  );
}
