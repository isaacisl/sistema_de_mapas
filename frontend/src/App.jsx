// Tela principal do Sistema de Mapas: sidebar de configuração + área do mapa.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analisarArquivo, baixarBlob, CONFIG_INICIAL, exportar, gerar } from './api';
import { NOMES_NIVEL, resolverCatCores } from './dados';
import EtapaPlanilha from './componentes/EtapaPlanilha';
import EtapaDados from './componentes/EtapaDados';
import EtapaAparencia from './componentes/EtapaAparencia';
import { SecaoLegenda, SecaoLinhas, SecaoTitulo } from './componentes/AjustesOpcionais';
import RodapeGerar, { oQueFalta } from './componentes/RodapeGerar';
import AreaMapa from './componentes/AreaMapa';
import ModalAjuda from './componentes/ModalAjuda';
import Tutorial from './componentes/Tutorial';

let _idToast = 0;
let _idResultado = 0;

export default function App() {
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);     // resposta de /analisar-csv
  const [aba, setAba] = useState(null);
  const [resultado, setResultado] = useState(null); // mapa na tela
  const [carregando, setCarregando] = useState(null); // mensagem do overlay
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(null); // 'png' | 'svg'
  const [modal, setModal] = useState(null);
  const [secoes, setSecoes] = useState({ linhas: false, legenda: false, titulo: false });
  const [toasts, setToasts] = useState([]);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef(null);
  const tutorialRef = useRef(null);

  const mudar = useCallback(parcial => setConfig(c => ({ ...c, ...parcial })), []);

  const toast = useCallback((msg, tipo = 'ok') => {
    const id = ++_idToast;
    setToasts(t => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);

  // ── Planilha ──────────────────────────────────────────────────────────────
  async function carregarArquivo(file, abaEscolhida) {
    setArquivo(file);
    toast('Lendo arquivo…', 'info');
    try {
      const d = await analisarArquivo(file, abaEscolhida);
      if (d.erro) { toast(d.erro, 'err'); return; }
      setAnalise(d);
      setAba(d.abas?.length > 1 ? d.aba_atual : null);
      // Começa sempre em município, com a coluna IBGE detectada pelo servidor
      mudar({
        nivel: 'municipio', focoUf: '', focoRegiao: '', showMun: false,
        colGeo: d.col_geo || '', colValor: '', catCores: {}, legLabels: {},
      });
      toast(`${d.total_linhas.toLocaleString('pt-BR')} linhas · ${d.colunas.length} colunas`, 'ok');
    } catch (e) {
      toast('Erro: ' + e.message, 'err');
    }
  }

  function removerArquivo() {
    setArquivo(null); setAnalise(null); setAba(null);
    if (inputRef.current) inputRef.current.value = '';
    mudar({ colGeo: '', colValor: '', catCores: {}, legLabels: {} });
    toast('Arquivo removido.', 'info');
  }

  // Arrastar o arquivo para qualquer ponto da tela
  useEffect(() => {
    const sobre = e => { e.preventDefault(); setArrastando(true); };
    const sai = e => { if (e.clientX === 0 && e.clientY === 0) setArrastando(false); };
    const solta = e => {
      e.preventDefault(); setArrastando(false);
      if (e.dataTransfer?.files[0]) carregarArquivo(e.dataTransfer.files[0]);
    };
    document.addEventListener('dragover', sobre);
    document.addEventListener('dragleave', sai);
    document.addEventListener('drop', solta);
    return () => {
      document.removeEventListener('dragover', sobre);
      document.removeEventListener('dragleave', sai);
      document.removeEventListener('drop', solta);
    };
  }); // recria a cada render para usar o carregarArquivo atual

  // ── Gerar / baixar ───────────────────────────────────────────────────────
  // Config pronta para envio: cores de categoria completas (escolhidas + padrão)
  function configParaEnvio() {
    const cats = analise?.valores_unicos?.[config.colValor];
    return { ...config, catCores: resolverCatCores(cats, config.catCores) };
  }

  async function gerarMapa() {
    const falta = oQueFalta(arquivo, config);
    if (falta) {
      toast(falta, 'err');
      const foco = !arquivo ? null : !config.colGeo ? 'sel-col-geo' : 'sel-col-num';
      if (foco) document.getElementById(foco)?.focus();
      return;
    }
    setGerando(true);
    setCarregando('Gerando mapa…');
    try {
      const d = await gerar(arquivo, aba, configParaEnvio());
      if (d.erro) { toast('Erro: ' + d.erro, 'err'); return; }
      const nivel = NOMES_NIVEL[config.nivel];
      const recorte = config.focoUf || config.focoRegiao;
      const base = {
        id: ++_idResultado,
        titulo: `${config.colValor} por ${nivel}${recorte ? ' — ' + recorte : ''}`,
        config: configParaEnvio(),
      };
      if (config.tipoMapa === 'html') {
        setResultado({ ...base, tipo: 'html', html: d.html, sub: `${arquivo.name} · Arraste para mover e use a roda do mouse para dar zoom.` });
        toast('Mapa interativo gerado!', 'ok');
      } else {
        setResultado({ ...base, tipo: 'figura', imagem: d.imagem, avisos: d.avisos, sub: `${arquivo.name} · Clique no mapa para ampliar.` });
        toast('Mapa gerado!', 'ok');
      }
    } catch (e) {
      toast('Erro de conexão: ' + e.message, 'err');
    } finally {
      setGerando(false);
      setCarregando(null);
    }
  }

  // Baixa em alta resolução com a MESMA configuração do mapa que está na tela
  async function baixar(formato) {
    if (resultado?.tipo !== 'figura') return;
    setExportando(formato);
    setCarregando(formato === 'png' ? 'Gerando PNG em 300 dpi…' : 'Gerando SVG vetorial…');
    try {
      await exportar(arquivo, aba, resultado.config, formato);
      toast(`${formato.toUpperCase()} exportado com sucesso!`, 'ok');
    } catch (e) {
      toast('Erro: ' + e.message, 'err');
    } finally {
      setExportando(null);
      setCarregando(null);
    }
  }

  function baixarHtml() {
    if (resultado?.tipo !== 'html') return;
    baixarBlob(new Blob([resultado.html], { type: 'text/html' }), 'mapa_cnm.html');
    toast('HTML exportado!', 'ok');
  }

  // Ctrl+Enter gera; Esc fecha o modal de ajuda
  useEffect(() => {
    const tecla = e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!gerando) gerarMapa();
      } else if (e.key === 'Escape') {
        setModal(null);
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  // Objeto estável: o tutorial reposiciona o balão quando ele muda
  const estadoTutorial = useMemo(() => ({ arquivo, config, resultado }), [arquivo, config, resultado]);

  const alternarSecao = nome => setSecoes(s => ({ ...s, [nome]: !s[nome] }));
  const abrirSecao = useCallback(nome => setSecoes(s => ({ ...s, [nome]: true })), []);

  return (
    <>
      <header id="topbar">
        <div className="logo"><img src="/static/Logo-CNM-branco.png" alt="CNM — Confederação Nacional de Municípios" /></div>
        <div className="sep"></div>
        <span className="sys-title"><i className="bi bi-map-fill me-2"></i>Sistema de Mapas</span>
        <button type="button" className="btn-tutorial" onClick={() => tutorialRef.current?.abrir()}>
          <i className="bi bi-question-circle"></i> Tutorial
        </button>
      </header>

      <div id="wrap">
        <aside id="sb">
          <div className="sb-head">
            <h6><i className="bi bi-sliders me-1"></i>Configurar mapa</h6>
            <small>Preencha de cima para baixo e clique em Gerar mapa.</small>
          </div>

          <div className="sb-body">
            <div id="modo-csv" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <EtapaPlanilha
                arquivo={arquivo} analise={analise} aba={aba} inputRef={inputRef} arrastando={arrastando}
                aoEscolher={f => carregarArquivo(f)} aoRemover={removerArquivo}
                aoMudarAba={a => carregarArquivo(arquivo, a)} abrirModal={setModal}
              />
              <EtapaDados analise={analise} config={config} mudar={mudar} abrirModal={setModal} />
            </div>

            <EtapaAparencia analise={analise} config={config} mudar={mudar} abrirModal={setModal} />

            <div className="etapa-opc">Ajustes opcionais</div>
            <SecaoLinhas config={config} mudar={mudar} aberta={secoes.linhas} aoAlternar={() => alternarSecao('linhas')} />
            <SecaoLegenda analise={analise} config={config} mudar={mudar} aberta={secoes.legenda} aoAlternar={() => alternarSecao('legenda')} />
            <SecaoTitulo config={config} mudar={mudar} aberta={secoes.titulo} aoAlternar={() => alternarSecao('titulo')} />
          </div>

          <RodapeGerar arquivo={arquivo} config={config} mudar={mudar} gerando={gerando} aoGerar={gerarMapa} />
        </aside>

        <AreaMapa
          resultado={resultado} tipoMapa={config.tipoMapa} temArquivo={!!arquivo}
          carregando={carregando} exportando={exportando}
          aoBaixar={baixar} aoBaixarHtml={baixarHtml}
          aoEscolherArquivo={() => inputRef.current?.click()}
        />
      </div>

      <div id="tc" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`tm ${t.tipo}`}>{t.msg}</div>)}
      </div>

      <ModalAjuda qual={modal} aoFechar={() => setModal(null)} />
      <Tutorial
        ref={tutorialRef}
        estado={estadoTutorial}
        abrirSecao={abrirSecao}
        aoConcluir={() => toast('Tutorial concluído! Agora você já sabe usar o sistema. 🎉', 'ok')}
      />
    </>
  );
}
