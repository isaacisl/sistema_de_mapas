# CNM Sistema de Mapas

App web: backend **100% Python** (Flask + GeoPandas + Matplotlib/Folium, só API) e front em
**React** (Vite, pasta `frontend/`). O usuário sobe uma planilha (CSV/XLSX/XLS), o sistema
detecta a coluna geográfica e gera mapa coroplético do Brasil por UF, região ou município:
imagem estática (Matplotlib) ou mapa interativo (Folium).

## Rodar
- Uso normal: `python app.py` → http://localhost:5000. O Flask serve o front já compilado
  de `static/dist/` (porta vem de `PORT`; servidor é o waitress).
- Desenvolver o front: `python app.py` + `npm run dev` em `frontend/` → http://localhost:5173
  (o Vite repassa `/analisar-csv`, `/gerar-mapa*` e `/static` para o Flask).
- **Mudou algo em `frontend/`? Rode `npm run build` em `frontend/` e commite `static/dist/`.**
  O Render e a VPS não têm Node: eles servem o build que está no Git.
- Trocou os shapefiles do IBGE de ano → `python preparar_geodata.py` regenera `geodata/*.parquet`.

## Deploy
- **Render**: `render.yaml` (plano free, `startCommand: python app.py`). Deploy = push no master.
- **VPS Windows**: serviço NSSM `MapaCNM`. `scratch_deploy_vps.ps1` roda **dentro da VPS**
  (stop → git pull → pip install → start); `scratch_listar_nssm.ps1` lista os serviços NSSM.

## Fluxo das rotas (app.py)
| Rota | O que faz |
|---|---|
| `/` | entrega `static/dist/index.html` (o app React) |
| `/analisar-csv` | lê a planilha, lista abas, detecta coluna geo (`_detectar_geo`) e colunas |
| `/gerar-mapa` | mapa estático (`_gerar_choropleth_csv` → `_renderizar`, Matplotlib); com `exportar=true` devolve o arquivo PNG/SVG |
| `/gerar-mapa-html` | mapa interativo Folium (import do folium é tardio, dentro da rota) |

Leitura de planilha: `_ler_csv` → `_detectar_linha_cabecalho` (cabeçalho fora da linha 1)
→ `_limpar_colunas_vazias` → `_tratar_numeros_br` (vírgula decimal, ponto de milhar).

## Front (frontend/src)
| Arquivo | Papel |
|---|---|
| `App.jsx` | estado (config, arquivo, resultado), gerar/baixar, atalhos (Ctrl+Enter, Esc) |
| `api.js` | `CONFIG_INICIAL` e chamadas ao Flask. **Nomes dos campos = os que `_extrair_params` lê** |
| `dados.js` | paletas, cores, fontes, UFs, prévias de legenda |
| `componentes/` | `EtapaPlanilha`, `EtapaDados`, `EtapaAparencia`, `AjustesOpcionais` (linhas/legenda/título), `RodapeGerar`, `AreaMapa`, `Tutorial`, `ModalAjuda`, `Basicos` |
| `ajuda/*.html` | conteúdo estático dos modais de ajuda (renderizado como HTML) |
| `estilos.css` | todo o CSS (cores CNM: `--blue #003DA5`); Bootstrap 5 + ícones vêm do npm |

- Tela: etapas numeradas (Planilha → Dados → Aparência) + ajustes opcionais recolhíveis;
  Gerar mapa fixo no rodapé com linha de status; downloads no cabeçalho do mapa, ativos só
  com mapa na tela. **Não mudar as cores** (pedido do usuário).
- Baixar PNG/SVG usa a config do mapa que está na tela (`resultado.config`), não a do formulário.

## Pegadinhas técnicas
- Geometria: `get_gdf()` prefere `geodata/<nivel>.parquet` (~7 MB, <1 s) e só cai no
  shapefile bruto (`shapefiles/`, ~336 MB, ~25 s) se o parquet não existir. Shapefiles
  **não vão para o Git**; os parquets vão.
- Tolerância de simplificação (`SIMPLIFY_TOL`) é aplicada ao gerar o parquet: mudou a
  tolerância → rodar `preparar_geodata.py` de novo.
- `preaquecer()` carrega UF e município em thread no start; `_gdf_lock` evita carga dupla.
- Merge com shapefile cria NaN e vira int em float (0 → 0.0): categorias passam por `_fmt_cat`.
- Comparar nomes de lugar sempre via `normalizar()` (minúsculo, sem acento).
- `MAX_CONTENT_LENGTH` = 300 MB (planilhas grandes de município).
- Natural Breaks é aleatório: a legenda classifica uma vez com semente fixa e reusa os cortes
  para pintar e contar (senão os números da legenda não batem com as cores).
- npm: Vite fixado na 7.x (a 8.x depende do `rolldown`, que deu 404 no registry em out/2026).
- Windows PowerShell 5.1: mensagem de commit com aspas quebra o `git commit -m`; usar `-F arquivo`.

## Economia de contexto
- **Nunca** ler/buscar em `shapefiles/`, `geodata/`, `__pycache__/`, `.claude/worktrees/`,
  `frontend/node_modules/`, `static/dist/` nem `*.png`.
- `app.py` (~1.200 linhas): achar o trecho com Grep e ler por offset/limit.
- Buscas amplas ("onde X é usado?") → agente `explorador` (Haiku), que devolve só o resumo.
- Mudanças visuais/novas telas → skill `frontend-design`, em componentes React.
- Código e comentários em português, seguindo o estilo existente.
