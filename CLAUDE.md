# CNM Sistema de Mapas

App web (Flask + GeoPandas + Matplotlib/Folium, front em um único `templates/index.html`
com Bootstrap 5 via CDN, sem framework JS). O usuário sobe uma planilha (CSV/XLSX/XLS),
o sistema detecta a coluna geográfica e gera mapa coroplético do Brasil por país, UF,
região ou município: imagem estática (Matplotlib) ou mapa interativo (Folium).

## Rodar
- `python app.py` → http://localhost:5000 (porta vem de `PORT`; servidor é o waitress).
- Trocou os shapefiles do IBGE de ano → `python preparar_geodata.py` regenera `geodata/*.parquet`.

## Deploy
- **Render**: `render.yaml` (plano free, `startCommand: python app.py`). Deploy = push no master.
- **VPS Windows**: serviço NSSM `MapaCNM`. `scratch_deploy_vps.ps1` roda **dentro da VPS**
  (stop → git pull → pip install → start); `scratch_listar_nssm.ps1` lista os serviços NSSM.

## Fluxo das rotas (app.py)
| Rota | O que faz |
|---|---|
| `/analisar-csv` | lê a planilha, lista abas, detecta coluna geo (`_detectar_geo`) e colunas |
| `/gerar-mapa` | mapa estático (`_gerar_choropleth_csv` → `_renderizar`, Matplotlib) |
| `/gerar-mapa-html` | mapa interativo Folium (import do folium é tardio, dentro da rota) |

Leitura de planilha: `_ler_csv` → `_detectar_linha_cabecalho` (cabeçalho fora da linha 1)
→ `_limpar_colunas_vazias` → `_tratar_numeros_br` (vírgula decimal, ponto de milhar).

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

## Economia de contexto
- **Nunca** ler/buscar em `shapefiles/`, `geodata/`, `__pycache__/`, `.claude/worktrees/` nem `*.png`.
- `templates/index.html` tem ~3.800 linhas (CSS + HTML + JS juntos): achar o trecho com
  Grep e ler por offset/limit; nunca ler inteiro. `app.py` (~1.200 linhas) idem.
- Buscas amplas ("onde X é usado?") → agente `explorador` (Haiku), que devolve só o resumo.
- Mudanças visuais/novas telas → skill `frontend-design`.
- Código e comentários em português, seguindo o estilo existente.
