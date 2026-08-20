import os
import io
import json
import threading
import unicodedata
import base64

import pandas as pd
import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.patches import Patch
from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 300 * 1024 * 1024

BASE_DIR = os.path.dirname(__file__)
SHP_DIR  = os.path.join(BASE_DIR, "shapefiles")
GEO_DIR  = os.path.join(BASE_DIR, "geodata")

# Nomes dos shapefiles originais do IBGE, por nível.
SHP_NOMES = {
    "pais":      "BR_Pais_2025",
    "uf":        "BR_UF_2025",
    "municipio": "BR_Municipios_2025",
}

# Tolerância de simplificação de geometria, por nível.
SIMPLIFY_TOL = {"municipio": 0.005}
TOL_PADRAO   = 0.001

_gdf      = {}
_gdf_lock = threading.Lock()


def ler_shapefile(nivel: str) -> gpd.GeoDataFrame:
    """Lê o shapefile bruto do IBGE, reprojeta e simplifica a geometria."""
    nome = SHP_NOMES[nivel]
    shp  = os.path.join(SHP_DIR, nome, f"{nome}.shp")
    gdf  = gpd.read_file(shp, encoding="utf-8").to_crs("EPSG:4326")
    tol  = SIMPLIFY_TOL.get(nivel, TOL_PADRAO)
    gdf["geometry"] = gdf["geometry"].simplify(tol, preserve_topology=True)
    return gdf


def get_gdf(nivel: str) -> gpd.GeoDataFrame:
    if nivel not in _gdf:
        with _gdf_lock:
            if nivel not in _gdf:
                # Preferimos o GeoParquet pré-simplificado (gerado por
                # preparar_geodata.py): são ~7 MB no total contra 336 MB de
                # shapefiles, e carrega em menos de 1 s em vez de ~25 s.
                pq = os.path.join(GEO_DIR, f"{nivel}.parquet")
                if os.path.exists(pq):
                    print(f"Carregando geodata {nivel} (parquet)...")
                    gdf = gpd.read_parquet(pq)
                else:
                    print(f"Carregando shapefile {nivel}...")
                    gdf = ler_shapefile(nivel)
                _gdf[nivel] = gdf
                print(f"  -> {len(gdf)} feicoes carregadas")
    return _gdf[nivel]


def normalizar(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s).strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def _fmt_cat(v):
    """Formata valor categórico como string. Números inteiros representados como
    float (ex.: 0.0, 1.0) — comum após merge com o shapefile, que introduz NaN e
    força o pandas a converter a coluna inteira para float — voltam a "0", "1"."""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


# ── Rotas ──────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analisar-csv", methods=["POST"])
def analisar_csv():
    arquivo = request.files.get("arquivo")
    if not arquivo:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400
    sheet_name = request.form.get("sheet_name") or None
    # Descobre abas antes de ler (precisa dos bytes brutos)
    nome = arquivo.filename.lower()
    raw_peek = arquivo.read()
    abas = _listar_abas(raw_peek, nome)
    aba_atual = sheet_name if sheet_name in abas else (abas[0] if abas else None)
    arquivo.seek(0)  # rebobina para _ler_csv poder ler novamente
    try:
        df = _ler_csv(arquivo, sheet_name=aba_atual)
        df = _tratar_numeros_br(df)
    except Exception as e:
        return jsonify({"erro": f"Erro ao ler arquivo: {e}"}), 400

    try:
        nivel_detectado, col_geo = _detectar_geo(df)
        valores_unicos = {}
        for col in df.columns:
            try:
                unicos = df[col].dropna().unique()
                if len(unicos) <= 50:
                    valores_unicos[col] = [_fmt_cat(v) for v in unicos]
            except Exception:
                pass
        amostra = []
        try:
            amostra = [
                {k: (v if isinstance(v, (str, int, float, bool)) or v is None else str(v))
                 for k, v in row.items()}
                for row in df.head(3).fillna("").to_dict(orient="records")
            ]
        except Exception:
            pass
        return jsonify({
            "colunas":         df.columns.tolist(),
            "numericas":       df.select_dtypes("number").columns.tolist(),
            "nivel_detectado": nivel_detectado,
            "col_geo":         col_geo,
            "total_linhas":    len(df),
            "amostra":         amostra,
            "valores_unicos":  valores_unicos,
            "abas":            abas,
            "aba_atual":       aba_atual,
        })
    except Exception as e:
        return jsonify({"erro": f"Erro ao processar arquivo: {e}"}), 400



@app.route("/gerar-mapa-html", methods=["POST"])
def gerar_mapa_html():
    import folium
    import branca.colormap as cm

    arquivo = request.files.get("arquivo")
    if not arquivo:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400

    col_geo   = request.form.get("col_geo", "")
    col_valor = request.form.get("col_valor", "")
    if not col_geo:
        return jsonify({"erro": "Selecione a coluna de localização"}), 400

    try:
        df = _ler_csv(arquivo, sheet_name=request.form.get("sheet_name") or None)
        df = _tratar_numeros_br(df)
    except Exception as e:
        return jsonify({"erro": f"Erro ao ler arquivo: {e}"}), 400

    params = _extrair_params(request.form)
    params["col_geo"]   = col_geo
    params["col_valor"] = col_valor
    tile_layer = request.form.get("tile_layer", "urbano")

    nivel     = params["nivel"]
    agregacao = params["agregacao"]

    try:
        gdf = get_gdf("uf" if nivel == "regiao" else nivel).copy()
        if nivel == "regiao":
            gdf["_dk"] = gdf["NM_REGIAO"].apply(normalizar)
            gdf = gdf.dissolve(by="_dk", aggfunc="first").reset_index()

        chaves = {
            "uf":        ["SIGLA_UF", "NM_UF", "CD_UF"],
            "municipio": ["NM_MUN", "CD_MUN"],
            "regiao":    ["NM_REGIAO"],
        }[nivel]

        def _limpar_ibge(v):
            try:    return str(int(float(v))).strip()
            except: return str(v).strip()

        df["_csv_norm"] = df[col_geo].apply(_limpar_ibge).apply(normalizar)

        if nivel == "uf":
            sample = [s for s in df["_csv_norm"].dropna().unique() if str(s).strip() != ""][:20]
            if sample and all(s.isdigit() and 6 <= len(s) <= 8 for s in sample):
                df["_csv_norm"] = df[col_geo].apply(
                    lambda x: normalizar(str(int(float(x)))[:2]) if pd.notna(x) and str(x).strip() != "" else ""
                )

        melhor_chave, melhor_taxa = None, 0.0
        for chave in chaves:
            if chave not in gdf.columns: continue
            gdf_vals = set(gdf[chave].astype(str).str.strip().apply(normalizar))
            csv_vals = set(df["_csv_norm"].dropna().unique())
            taxa = len(csv_vals & gdf_vals) / max(len(csv_vals), 1)
            if taxa > melhor_taxa:
                melhor_taxa, melhor_chave = taxa, chave

        if not melhor_chave or melhor_taxa == 0:
            raise ValueError(f"Nenhum valor da coluna '{col_geo}' bateu com o shapefile de '{nivel}'.")

        gdf["_key_norm"] = gdf[melhor_chave].astype(str).str.strip().apply(normalizar)

        if col_valor and col_valor in df.columns and agregacao != "count":
            df[col_valor] = pd.to_numeric(df[col_valor], errors="coerce")
            agg_fn = {"sum": "sum", "mean": "mean", "max": "max", "min": "min"}.get(agregacao, "sum")
            dados = df.groupby("_csv_norm")[col_valor].agg(agg_fn).reset_index()
        else:
            dados = df.groupby("_csv_norm").size().reset_index(name="valor")
            col_valor = "valor"

        dados.columns = ["_key_norm", "valor"]
        merged = gdf.merge(dados, on="_key_norm", how="left")
        merged["valor"] = pd.to_numeric(merged["valor"], errors="coerce")
        merged = _filtrar(merged, params["filtro_uf"], params["filtro_regiao"])
        merged = merged[merged.geometry.notna() & ~merged.geometry.is_empty].copy()

        if len(merged) == 0:
            raise ValueError("Nenhuma geometria válida após filtros.")

        # Nome da coluna de label para tooltip
        nome_label = next((c for c in ["NM_MUN", "NM_UF", "NM_REGIAO", "SIGLA_UF"] if c in merged.columns), "_key_norm")

        vmin = float(merged["valor"].dropna().min())
        vmax = float(merged["valor"].dropna().max())

        palette_map = {
            "Blues":    ["#eff3ff","#bdd7e7","#6baed6","#2171b5","#084594"],
            "Reds":     ["#fee5d9","#fcae91","#fb6a4a","#de2d26","#a50f15"],
            "Greens":   ["#edf8e9","#bae4b3","#74c476","#31a354","#006d2c"],
            "Oranges":  ["#fff5eb","#fdd0a2","#fdae6b","#e6550d","#a63603"],
            "Purples":  ["#f2f0f7","#cbc9e2","#9e9ac8","#756bb1","#54278f"],
            "YlOrRd":   ["#ffffb2","#fecc5c","#fd8d3c","#f03b20","#bd0026"],
            "YlGnBu":   ["#ffffcc","#a1dab4","#41b6c4","#2c7fb8","#253494"],
            "RdPu":     ["#feebe2","#fbb4b9","#f768a1","#c51b8a","#7a0177"],
            "viridis":  ["#440154","#31688e","#35b779","#fde725","#fde725"],
            "plasma":   ["#0d0887","#7e03a8","#cc4778","#f89540","#f0f921"],
            "coolwarm": ["#3b4cc0","#6688ee","#dddddd","#ee8866","#b40426"],
            "RdYlGn":   ["#d73027","#fc8d59","#fee08b","#91cf60","#1a9850"],
        }
        palette_id = params.get("palette", "Blues")
        colors = palette_map.get(palette_id, palette_map["Blues"])
        colormap = cm.LinearColormap(colors, vmin=vmin, vmax=vmax, caption=col_valor)

        bounds = merged.total_bounds
        center_lat = (bounds[1] + bounds[3]) / 2
        center_lon = (bounds[0] + bounds[2]) / 2

        # Cria o mapa sem tile padrão para controlar os nomes manualmente
        m = folium.Map(location=[center_lat, center_lon], zoom_start=4, tiles=None)

        tile_urbano = folium.TileLayer(
            tiles="OpenStreetMap",
            name="Urbano",
        )
        tile_satelite = folium.TileLayer(
            tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attr="Tiles &copy; Esri",
            name="Satélite",
        )

        # Adiciona o tile não-selecionado primeiro, depois o selecionado (fica ativo por cima)
        if tile_layer == "satelite":
            tile_urbano.add_to(m)
            tile_satelite.add_to(m)
        else:
            tile_satelite.add_to(m)
            tile_urbano.add_to(m)

        geojson_data = merged[[nome_label, "valor", "geometry"]].to_json()

        folium.GeoJson(
            geojson_data,
            style_function=lambda feature: {
                "fillColor": colormap(feature["properties"]["valor"])
                             if feature["properties"]["valor"] is not None
                             else "#d9d9d9",
                "color": "#333",
                "weight": 0.5,
                "fillOpacity": 0.75,
            },
            tooltip=folium.GeoJsonTooltip(
                fields=[nome_label, "valor"],
                aliases=["Área:", col_valor + ":"],
                localize=True,
            ),
        ).add_to(m)

        colormap.add_to(m)
        folium.LayerControl(collapsed=False).add_to(m)

        html_content = m._repr_html_()
        return jsonify({"html": html_content})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"erro": str(e)}), 500


@app.route("/gerar-mapa", methods=["POST"])
def gerar_mapa():
    arquivo = request.files.get("arquivo")
    if not arquivo:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400

    col_geo   = request.form.get("col_geo", "")
    col_valor = request.form.get("col_valor", "")
    if not col_geo:
        return jsonify({"erro": "Selecione a coluna de localização"}), 400

    try:
        df = _ler_csv(arquivo, sheet_name=request.form.get("sheet_name") or None)
        df = _tratar_numeros_br(df)
    except Exception as e:
        return jsonify({"erro": f"Erro ao ler arquivo: {e}"}), 400

    params = _extrair_params(request.form)
    params["col_geo"]   = col_geo
    params["col_valor"] = col_valor

    try:
        png, avisos = _gerar_choropleth_csv(df, **params)
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"erro": str(e)}), 500

    fmt = params.get("formato_export", "png")
    if params["exportar"]:
        if fmt == "svg":
            return send_file(io.BytesIO(png), mimetype="image/svg+xml",
                             as_attachment=True, download_name="mapa_cnm.svg")
        return send_file(io.BytesIO(png), mimetype="image/png",
                         as_attachment=True, download_name="mapa_cnm.png")
    resp = {"imagem": "data:image/png;base64," + base64.b64encode(png).decode()}
    if avisos:
        resp["avisos"] = avisos
    return jsonify(resp)



# ── Helpers de parsing ─────────────────────────────────────────────────────────

def _extrair_params(form):
    def f(k, default=""):  return form.get(k, default)
    def fb(k, default=False): return f(k, "true" if default else "false") == "true"
    def ff(k, default=0.0):
        try: return float(f(k, str(default)))
        except: return default
    def fi(k, default=0):
        try: return max(2, int(f(k, str(default))))
        except: return default

    return dict(
        exportar      = fb("exportar"),
        formato_export = f("formato_export", "png"),
        nivel         = f("nivel", "municipio"),
        agregacao     = f("agregacao", "sum"),
        palette       = f("palette", "Blues"),
        # linha municípios
        show_mun      = fb("show_mun"),
        esp_mun       = ff("esp_mun", 0.3),
        cor_mun       = f("cor_mun", "black"),
        # linha UF
        show_uf       = fb("show_uf"),
        esp_uf        = ff("esp_uf", 0.8),
        cor_uf        = f("cor_uf", "black"),
        # linha região
        show_reg      = fb("show_reg"),
        esp_reg       = ff("esp_reg", 1.5),
        cor_reg       = f("cor_reg", "black"),
        # foco geográfico
        filtro_uf     = f("filtro_uf", ""),
        filtro_regiao = f("filtro_regiao", ""),
        # distribuição de cores
        escala_cor    = f("escala_cor", "linear"),
        # título
        titulo_texto  = f("titulo_texto", "Mapa temático do Brasil"),
        titulo_fonte  = f("titulo_fonte", "DejaVu Sans"),
        titulo_tam    = ff("titulo_tam", 16.0),
        titulo_negrito= fb("titulo_negrito"),
        titulo_italico= fb("titulo_italico"),
        titulo_sublinhado= fb("titulo_sublinhado"),
        titulo_ha     = f("titulo_ha", "center"),
        titulo_x      = ff("titulo_x", 0.5),
        titulo_y      = ff("titulo_y", 1.02),
        # tipo de visualização
        tipo_viz      = f("tipo_viz", "calorico"),
        # legenda
        tipo_legenda  = f("tipo_legenda", "Sem legenda"),
        orient_leg    = f("orient_leg", "vertical"),
        loc_leg       = f("loc_leg", "lower right"),
        k_legenda     = fi("k_legenda", 5),
        leg_labels    = json.loads(f("leg_labels", "{}") or "{}"),
        titulo_leg    = f("titulo_leg", ""),
        titulo_leg_ativo = fb("titulo_leg_ativo", True),
        titulo_ativo  = fb("titulo_ativo", True),
        leg_fonte     = f("leg_fonte", "DejaVu Sans"),
        leg_tam       = fi("leg_tam", 9),
        cat_cores     = json.loads(f("cat_cores", "{}") or "{}"),
        sem_dado_hachura = fb("sem_dado_hachura", True),
        cor_sem_dado  = f("cor_sem_dado", "#d9d9d9"),
        cor_hachura   = f("cor_hachura", "#999999"),
        dpi           = 300 if fb("exportar") else 120,
    )


# ── Geração de coroplético ─────────────────────────────────────────────────────

def _gerar_choropleth_csv(df, nivel, col_geo, col_valor, agregacao, **kw):
    is_cat = kw.get("tipo_viz") == "categorico"
    gdf = get_gdf("uf" if nivel == "regiao" else nivel).copy()

    if nivel == "regiao":
        gdf["_dk"] = gdf["NM_REGIAO"].apply(normalizar)
        gdf = gdf.dissolve(by="_dk", aggfunc="first").reset_index()

    chaves = {
        "uf":        ["SIGLA_UF", "NM_UF", "CD_UF"],
        "municipio": ["NM_MUN", "CD_MUN"],
        "regiao":    ["NM_REGIAO"],
    }[nivel]

    # Converte a coluna geo para string limpa (trata float como 3550308.0 → "3550308")
    def _limpar_ibge(v):
        try:
            return str(int(float(v))).strip()
        except (ValueError, TypeError):
            return str(v).strip()

    df["_csv_norm"] = df[col_geo].apply(_limpar_ibge).apply(normalizar)

    # Se nivel=UF e os valores parecem código IBGE de 6-7 dígitos de município,
    # extrai os 2 primeiros dígitos para obter o código da UF
    if nivel == "uf":
        sample = [s for s in df["_csv_norm"].dropna().unique() if str(s).strip() != ""][:20]
        if len(sample) > 0 and all(s.isdigit() and 6 <= len(s) <= 8 for s in sample):
            df["_csv_norm"] = df[col_geo].apply(
                lambda x: normalizar(str(int(float(x)))[:2]) if pd.notna(x) and str(x).strip() != "" else ""
            )

    melhor_chave, melhor_taxa = None, 0.0

    for chave in chaves:
        if chave not in gdf.columns:
            continue
        gdf_vals = set(gdf[chave].astype(str).str.strip().apply(normalizar))
        csv_vals = set(df["_csv_norm"].dropna().unique())
        taxa = len(csv_vals & gdf_vals) / max(len(csv_vals), 1)
        if taxa > melhor_taxa:
            melhor_taxa, melhor_chave = taxa, chave

    if not melhor_chave or melhor_taxa == 0:
        raise ValueError(
            f"Nenhum valor da coluna '{col_geo}' bateu com o shapefile de '{nivel}'. "
            f"Verifique o nível geográfico e a coluna selecionada."
        )

    gdf["_key_norm"] = gdf[melhor_chave].astype(str).str.strip().apply(normalizar)

    if col_valor and col_valor in df.columns and agregacao != "count":
        if is_cat:
            # Coluna de texto: mantém o valor como string, pega o mais frequente por área
            dados = df.groupby("_csv_norm")[col_valor].agg(
                lambda x: x.dropna().mode().iloc[0] if len(x.dropna()) > 0 else None
            ).reset_index()
        else:
            df[col_valor] = pd.to_numeric(df[col_valor], errors="coerce")
            agg_fn = {"sum": "sum", "mean": "mean", "max": "max", "min": "min"}.get(agregacao, "sum")
            dados = df.groupby("_csv_norm")[col_valor].agg(agg_fn).reset_index()
        dados.columns = ["_key_norm", "valor"]
        nome_val = kw["titulo_leg"] or col_valor
    else:
        dados = df.groupby("_csv_norm").size().reset_index(name="valor")
        dados.columns = ["_key_norm", "valor"]
        nome_val = kw["titulo_leg"] or ("Contagem de registros" if agregacao == "count" else f"Registros por {nivel}")

    # Sanitiza: garante que o título da legenda nunca apareça como "nan" ou "None"
    if not nome_val or str(nome_val).strip().lower() in ("nan", "none", ""):
        nome_val = "Valor"

    # ── Rastrear códigos não encontrados no shapefile ──────────────────────────
    gdf_keys = set(gdf["_key_norm"].unique())
    csv_keys = set(df["_csv_norm"].unique()) - {"", "nan"}
    unmatched_norm = csv_keys - gdf_keys
    # Mapeia chave normalizada de volta para o valor original
    orig_map = {normalizar(str(v)): str(v) for v in df[col_geo].dropna().unique()}
    unmatched_orig = sorted(orig_map.get(k, k) for k in unmatched_norm)

    merged = gdf.merge(dados, on="_key_norm", how="left")
    if not is_cat:
        merged["valor"] = pd.to_numeric(merged["valor"], errors="coerce")
    merged = _filtrar(merged, kw["filtro_uf"], kw["filtro_regiao"])
    if len(merged) == 0:
        raise ValueError("Nenhuma geometria encontrada para o filtro selecionado.")

    # ── Diagnóstico: valores após merge ───────────────────────────────────────
    vals_validos = merged["valor"].dropna()
    n_com_dado   = len(vals_validos)
    n_total      = len(merged)

    # Nenhum dado bateu com o shapefile
    if n_com_dado == 0:
        raise ValueError(
            f"Nenhum valor da coluna '{col_geo}' conseguiu ser associado ao mapa de "
            f"'{nivel}'. Verifique se a coluna selecionada realmente contém "
            f"códigos/nomes geográficos do nível escolhido."
        )

    # Todos os valores são idênticos → mapa seria uma cor só (só para numérico)
    if not is_cat and vals_validos.nunique() == 1:
        valor_unico = vals_validos.iloc[0]
        dica = ""
        if agregacao == "count" or not (col_valor and col_valor in df.columns):
            dica = " Você usou 'Contagem' — se há 1 linha por área, todos ficam com valor 1."
        else:
            try:    dica = f" Todos os registros têm '{col_valor}' = {float(valor_unico):.4g}."
            except: dica = f" Todos os registros têm '{col_valor}' = {valor_unico}."
        raise ValueError(
            f"Todos os {n_com_dado} polígonos têm o mesmo valor ({valor_unico}), "
            f"impossível gerar gradiente de cores.{dica} "
            f"Tente trocar a coluna de valor ou o tipo de agregação."
        )

    # Aviso parcial: áreas sem dado — identifica quais são pelo nome no shapefile
    sem_dado = n_total - n_com_dado
    sem_dado_nomes = []
    if sem_dado > 0:
        print(f"[AVISO] {sem_dado}/{n_total} áreas sem dado (NaN) — aparecerão em cinza no mapa.")
        mask_sem = merged["valor"].isna()
        for col_nome in ["NM_MUN", "NM_UF", "NM_REGIAO", "SIGLA_UF"]:
            if col_nome in merged.columns:
                nomes = merged.loc[mask_sem, col_nome].dropna().astype(str).tolist()
                if nomes:
                    sem_dado_nomes = sorted(set(nomes))
                    break

    avisos = {}
    if unmatched_orig:
        avisos["sem_match"] = unmatched_orig
    if sem_dado_nomes:
        avisos["sem_dado"] = sem_dado_nomes

    png = _renderizar(merged, "valor", nome_val, **kw)
    return png, avisos




def _filtrar(gdf, filtro_uf, filtro_regiao):
    if filtro_uf:
        for col in ["SIGLA_UF", "uf", "UF"]:
            if col in gdf.columns:
                return gdf[gdf[col].astype(str).str.upper().str.strip() == filtro_uf.upper()].copy()
    if filtro_regiao:
        for col in ["NM_REGIAO", "_dk"]:
            if col in gdf.columns:
                return gdf[gdf[col].astype(str).str.strip() == filtro_regiao].copy()
        # fallback: derivar região a partir de SIGLA_UF
        MAPA_REGIOES = {
            "RO":"Norte","AC":"Norte","AM":"Norte","RR":"Norte","PA":"Norte","AP":"Norte","TO":"Norte",
            "MA":"Nordeste","PI":"Nordeste","CE":"Nordeste","RN":"Nordeste","PB":"Nordeste",
            "PE":"Nordeste","AL":"Nordeste","SE":"Nordeste","BA":"Nordeste",
            "MT":"Centro-Oeste","MS":"Centro-Oeste","GO":"Centro-Oeste","DF":"Centro-Oeste",
            "MG":"Sudeste","ES":"Sudeste","RJ":"Sudeste","SP":"Sudeste",
            "PR":"Sul","SC":"Sul","RS":"Sul",
        }
        for col in ["SIGLA_UF"]:
            if col in gdf.columns:
                g = gdf.copy()
                g["__R"] = g[col].astype(str).str.upper().map(MAPA_REGIOES)
                return g[g["__R"] == filtro_regiao].copy()
    return gdf.copy()


def _renderizar(merged, col_plot, nome_val,
                palette, escala_cor, tipo_viz,
                tipo_legenda, orient_leg, loc_leg, k_legenda,
                show_mun, esp_mun, cor_mun,
                show_uf, esp_uf, cor_uf,
                show_reg, esp_reg, cor_reg,
                filtro_uf, filtro_regiao,
                titulo_texto, titulo_fonte, titulo_tam,
                titulo_negrito, titulo_italico, titulo_sublinhado, titulo_ha, titulo_x, titulo_y,
                titulo_ativo=True,
                titulo_leg_ativo=True,
                leg_labels=None,
                leg_fonte="DejaVu Sans", leg_tam=9,
                cat_cores=None,
                sem_dado_hachura=True,
                cor_sem_dado="#d9d9d9", cor_hachura="#999999",
                dpi=120, formato_export="png", **_):

    # Descarta geometrias nulas/vazias (evita erro "aspect must be finite and positive")
    merged = merged[merged.geometry.notna() & ~merged.geometry.is_empty].copy()
    if len(merged) == 0:
        raise ValueError("Nenhuma geometria válida para renderizar. Verifique o recorte geográfico.")

    import numpy as np

    # ── Distribuição de cores ──────────────────────────────────────────────────
    # "proporcional": substitui valores pelo rank percentual (0→1)
    #   → cada faixa de municípios recebe a mesma largura de cor
    #   → resolve o problema de regiões dominantes "lavarem" o mapa
    # "log": comprime valores altos, expande baixos
    # "linear": comportamento padrão
    col_plot_render = col_plot   # coluna usada para colorir (pode ser substituída)
    _escala = str(escala_cor).strip().lower()
    _orig_vals_cb = None   # valores originais para rótulos do colorbar

    _missing_color = cor_sem_dado
    if _escala == "proporcional":
        mask = merged[col_plot].notna()
        if mask.sum() > 1:
            _orig_vals_cb = pd.to_numeric(merged.loc[mask, col_plot], errors="coerce").dropna().values
            merged["_rank_pct"] = np.nan
            merged.loc[mask, "_rank_pct"] = (
                merged.loc[mask, col_plot]
                      .rank(method="average", pct=True)
            )
            col_plot_render = "_rank_pct"
        _missing_hatch = None
    elif _escala == "log":
        _orig_vals_cb = pd.to_numeric(merged[col_plot], errors="coerce").dropna().values
        _missing_hatch = "///" if sem_dado_hachura else None
    else:
        _missing_hatch = "///" if sem_dado_hachura else None

    fig, ax = plt.subplots(1, 1, figsize=(12, 10))
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    mun_visivel = show_mun and cor_mun != 'none'
    edge   = cor_mun if mun_visivel else 'face'
    lw_mun = esp_mun if mun_visivel else 0.3
    # Hachura de "sem dado" usa cor própria (não depende da linha de município), mas a
    # BORDA em volta de cada município sem dado só aparece se a linha de município
    # estiver ligada — senão o contorno "vaza" e parece linha de município mesmo desligada.
    # linewidth=0 não afeta o hachurado: o matplotlib desenha o padrão com espessura própria.
    missing = {"color": _missing_color, "edgecolor": cor_hachura if _missing_hatch else edge,
               "linewidth": lw_mun if mun_visivel else 0}
    if _missing_hatch:
        missing["hatch"] = _missing_hatch

    com_legenda = tipo_legenda != "Sem legenda"

    if tipo_viz == "categorico":
        merged[col_plot] = merged[col_plot].apply(
            lambda v: _fmt_cat(v) if pd.notna(v) and str(v).strip().lower() not in ("nan", "none", "") else None
        )
        fmt_n = lambda n: f"{n:,}".replace(",", ".")

        if cat_cores:
            # Renderiza cada categoria separadamente (color=list-of-strings não é suportado
            # pelo geopandas para coloração por feição — única cor por chamada é confiável)

            # 1. Áreas sem dado (NaN) → cor/hachura configuradas em "Estilos de Linha"
            mask_nan = merged[col_plot].isna()
            if mask_nan.any():
                merged[mask_nan].plot(ax=ax, aspect=None, **missing)

            # 2. Cada categoria com sua cor customizada
            for cat_val, cor in cat_cores.items():
                mask = merged[col_plot] == str(cat_val)
                if mask.any():
                    merged[mask].plot(ax=ax, color=cor,
                                      linewidth=lw_mun, edgecolor=edge, aspect=None)

            # 3. Categorias não mapeadas (não estão em cat_cores) → cinza padrão
            cats_conhecidas = {str(k) for k in cat_cores}
            mask_outros = merged[col_plot].notna() & ~merged[col_plot].isin(cats_conhecidas)
            if mask_outros.any():
                merged[mask_outros].plot(ax=ax, color="#cccccc",
                                         linewidth=lw_mun, edgecolor=edge, aspect=None)

            if com_legenda:
                cats_no_mapa = [c for c in cat_cores
                                if c in merged[col_plot].dropna().values]
                patches = []
                for c in cats_no_mapa:
                    n = int((merged[col_plot] == c).sum())
                    patches.append(Patch(color=cat_cores[c],
                                         label=f"{c}  —  {fmt_n(n)}"))
                ax.legend(handles=patches, title=nome_val, loc=loc_leg,
                          frameon=True, framealpha=0.9, fontsize=leg_tam)
        else:
            # Renderiza com paleta automática
            kw = dict(column=col_plot, categorical=True, cmap=palette,
                      linewidth=lw_mun, edgecolor=edge, ax=ax,
                      missing_kwds=missing, legend=com_legenda, aspect=None)
            if com_legenda:
                kw["legend_kwds"] = {"title": nome_val, "loc": loc_leg,
                                     "frameon": True, "fontsize": leg_tam}
            merged.plot(**kw)
            if com_legenda:
                try:
                    _leg = ax.get_legend()
                    if _leg:
                        cats = merged[col_plot].dropna().unique()
                        counts = {str(c): int((merged[col_plot] == str(c)).sum()) for c in cats}
                        for txt in _leg.get_texts():
                            label = txt.get_text().strip()
                            if label.lower() not in ("nan", "none", "") and label in counts:
                                txt.set_text(f"{label}  —  {fmt_n(counts[label])}")
                except Exception as _e:
                    print(f"[WARN] Contagem categórica: {_e}")

    else:
        # Calcula range real dos dados (ignorando NaN)
        vals_numericos = pd.to_numeric(merged[col_plot_render], errors="coerce").dropna()
        vmin_data = float(vals_numericos.min()) if len(vals_numericos) > 0 else 0.0
        vmax_data = float(vals_numericos.max()) if len(vals_numericos) > 0 else 1.0

        # vmin == vmax: abre intervalo artificial para evitar cor única
        if vmin_data == vmax_data:
            delta = abs(vmin_data) * 0.1 if vmin_data != 0 else 1.0
            vmin_data = vmin_data - delta
            vmax_data = vmax_data + delta

        # Dados muito assimétricos com escala linear → Natural Breaks automático
        usar_breaks = False
        if _escala == "linear" and tipo_legenda == "Contínua" and len(vals_numericos) >= 3:
            mediana = float(np.median(vals_numericos))
            if mediana > 0 and (vmax_data / mediana) > 5:
                usar_breaks = True
                print(f"[INFO] Assimetria detectada (max={vmax_data:.1f}, mediana={mediana:.1f})."
                      f" Usando Natural Breaks.")

        # Normalização Log (escala_cor="log")
        norm_log = None
        _log_shift = 0
        if _escala == "log":
            if vmin_data <= 0:
                _log_shift = int(abs(vmin_data)) + 1
                merged[col_plot_render] = merged[col_plot_render] + _log_shift
                vmin_data += _log_shift
                vmax_data += _log_shift
            norm_log = mcolors.LogNorm(vmin=max(vmin_data, 1e-9), vmax=vmax_data)

        kw_plot = {
            "column": col_plot_render, "cmap": palette,
            "linewidth": esp_mun, "edgecolor": edge,
            "ax": ax, "missing_kwds": missing, "aspect": None,
        }

        if norm_log:
            kw_plot["norm"] = norm_log

        if not com_legenda:
            kw_plot["legend"] = False
            if not usar_breaks and not norm_log:
                kw_plot["vmin"] = vmin_data
                kw_plot["vmax"] = vmax_data
        elif tipo_legenda == "Contínua" and not usar_breaks:
            kw_plot["legend"] = True
            if not norm_log:
                kw_plot["vmin"] = vmin_data
                kw_plot["vmax"] = vmax_data
            leg = {"label": nome_val, "shrink": 0.55}
            if orient_leg == "horizontal":
                leg["orientation"] = "horizontal"
                leg["pad"] = 0.04
            kw_plot["legend_kwds"] = leg
        else:
            # Classificado (ou fallback automático de dados assimétricos)
            # "Contagem" usa Natural Breaks e depois injeta contagem em cada faixa
            scheme_map = {"Quantiles":      "quantiles",
                          "Equal Interval": "equal_interval",
                          "Natural Breaks": "natural_breaks",
                          "Contagem":       "natural_breaks"}
            kw_plot["legend"] = True
            kw_plot["legend_kwds"] = {"title": nome_val, "fmt": "{:.1f}", "loc": loc_leg}
            if usar_breaks:
                # Assimetria detectada: Natural Breaks dá melhor distribuição visual
                kw_plot["scheme"] = "natural_breaks"
                kw_plot["k"]      = k_legenda
            elif tipo_legenda in scheme_map:
                kw_plot["scheme"] = scheme_map[tipo_legenda]
                kw_plot["k"]      = k_legenda

        try:
            merged.plot(**kw_plot)

            # ── Colorbar: mostra valores reais do dado (log e proporcional) ──────
            if com_legenda and tipo_legenda == "Contínua" and _orig_vals_cb is not None and len(_orig_vals_cb) > 0:
                try:
                    def _fmt_real(v):
                        if v >= 1_000_000: return f"{v/1e6:.1f}M".replace(".", ",")
                        if v >= 1_000:     return f"{int(v/1e3)}k"
                        if v >= 1:         return f"{int(round(v))}"
                        return f"{v:.2g}"

                    _fig = ax.get_figure()
                    for _cax in _fig.axes:
                        if _cax is ax:
                            continue
                        _horiz = orient_leg == "horizontal"

                        if _escala == "log" and norm_log:
                            # Posições no espaço shiftado; labels mostram valores originais
                            _v0s = float(norm_log.vmin)
                            _v1s = float(norm_log.vmax)
                            _inner = list(np.logspace(np.log10(_v0s), np.log10(_v1s), 5))[1:-1]
                            _ticks = [_v0s] + _inner + [_v1s]
                            _labels = [_fmt_real(t - _log_shift) for t in _ticks]
                            if _horiz:
                                _cax.set_xticks(_ticks)
                                _cax.set_xticklabels(_labels)
                            else:
                                _cax.set_yticks(_ticks)
                                _cax.set_yticklabels(_labels)

                        elif _escala == "proporcional":
                            # Mostra só min e max reais, igual à escala linear
                            _tks = list(_cax.get_xticks() if _horiz else _cax.get_yticks())
                            _v_min = float(np.min(_orig_vals_cb))
                            _v_max = float(np.max(_orig_vals_cb))
                            _new_lbls = [''] * len(_tks)
                            if _tks:
                                _new_lbls[0]  = _fmt_real(_v_min)
                                _new_lbls[-1] = _fmt_real(_v_max)
                            if _horiz:
                                _cax.set_xticks(_tks)
                                _cax.set_xticklabels(_new_lbls)
                            else:
                                _cax.set_yticks(_tks)
                                _cax.set_yticklabels(_new_lbls)
                except Exception as _e:
                    print(f"[WARN] Formatação colorbar real falhou: {_e}")

            # ── Oculta título da colorbar se desativado ───────────────────────
            if com_legenda and tipo_legenda == "Contínua" and not titulo_leg_ativo:
                try:
                    for _cax in ax.get_figure().axes:
                        if _cax is ax:
                            continue
                        _cax.set_xlabel("")
                        _cax.set_ylabel("")
                        _cax.set_title("")
                except Exception:
                    pass

            # ── Pós-processamento "Contagem": injeta nº de itens em cada faixa ──
            if tipo_legenda == "Contagem" and com_legenda:
                try:
                    import mapclassify as _mc
                    _vals = pd.to_numeric(
                        merged[col_plot_render], errors="coerce"
                    ).dropna().values
                    _clf    = _mc.NaturalBreaks(_vals, k=k_legenda)
                    _counts = list(_clf.counts)
                    _leg    = ax.get_legend()
                    if _leg:
                        for i, _txt in enumerate(_leg.get_texts()):
                            if i >= len(_counts):
                                break
                            _n = int(_counts[i])
                            _txt.set_text(f"{_n:,}".replace(",", ".") + " municípios")
                except Exception as _e:
                    print(f"[WARN] Contagem – pós-processamento de legenda falhou: {_e}")

            # ── Remove entradas "nan" da legenda (áreas sem dados) ──────────────
            if com_legenda:
                try:
                    _leg = ax.get_legend()
                    if _leg:
                        _hs = list(_leg.legend_handles)
                        _ts = [t.get_text() for t in _leg.get_texts()]
                        _tit = _leg.get_title().get_text()
                        _pairs = [(h, t) for h, t in zip(_hs, _ts)
                                  if t.strip().lower() not in ("nan", "none", "")]
                        if len(_pairs) < len(_hs):   # havia entradas inválidas
                            _leg.remove()
                            if _pairs:
                                _hs2, _ts2 = zip(*_pairs)
                                ax.legend(list(_hs2), list(_ts2),
                                          title=_tit, loc=loc_leg,
                                          frameon=True, framealpha=0.9, fontsize=leg_tam)
                except Exception as _e:
                    print(f"[WARN] Remoção de nan da legenda falhou: {_e}")

            # ── Fonte e tamanho da legenda ────────────────────────────────────
            try:
                _leg = ax.get_legend()
                if _leg:
                    for _txt in _leg.get_texts():
                        _txt.set_fontsize(leg_tam)
                        try: _txt.set_fontfamily(leg_fonte)
                        except Exception: pass
                    _tit = _leg.get_title()
                    if _tit:
                        if not titulo_leg_ativo:
                            _tit.set_text("")
                        elif _tit.get_text():
                            _tit.set_fontsize(leg_tam + 1)
                            try: _tit.set_fontfamily(leg_fonte)
                            except Exception: pass
            except Exception as _e:
                print(f"[WARN] Estilo de fonte da legenda falhou: {_e}")

        except Exception:
            # Fallback: remove classificação e plota contínuo com range explícito
            kw_plot.pop("scheme", None)
            kw_plot.pop("k", None)
            # SEMPRE define vmin/vmax no fallback (evita cor única quando range=0)
            kw_plot["vmin"] = vmin_data
            kw_plot["vmax"] = vmax_data
            kw_plot["legend"] = com_legenda
            if com_legenda:
                kw_plot["legend_kwds"] = {"label": nome_val, "shrink": 0.55}
            merged.plot(**kw_plot)

    # Camadas de contorno
    if show_uf and cor_uf != "none":
        uf = get_gdf("uf").copy()
        if filtro_uf or filtro_regiao:
            uf = _filtrar(uf, filtro_uf, filtro_regiao)
        uf.boundary.plot(ax=ax, color=cor_uf, linewidth=esp_uf, zorder=2, aspect=None)

    if show_reg and cor_reg != "none":
        rg = get_gdf("uf").copy()
        rg["_dk"] = rg["NM_REGIAO"].apply(normalizar)
        rg = rg.dissolve(by="_dk", aggfunc="first").reset_index()
        if filtro_uf or filtro_regiao:
            rg = _filtrar(rg, filtro_uf, filtro_regiao)
        rg.boundary.plot(ax=ax, color=cor_reg, linewidth=esp_reg, zorder=3, aspect=None)

    # Restaura proporção correta após os plots com aspect=None
    try:
        ax.set_aspect("equal")
    except Exception:
        pass

    # Título
    if not titulo_ativo:
        titulo_texto = ""
    peso   = "bold"   if titulo_negrito else "normal"
    estilo = "italic" if titulo_italico else "normal"
    t = ax.set_title(titulo_texto, fontsize=titulo_tam, fontweight=peso, fontstyle=estilo, pad=10)
    try:
        ax.title.set_position([titulo_x, titulo_y])
        ax.title.set_ha(titulo_ha)
        ax.title.set_fontfamily(titulo_fonte)
        if titulo_sublinhado:
            ax.annotate('', xy=(0, -0.1), xycoords=t, xytext=(1, -0.1), textcoords=t,
                        arrowprops=dict(arrowstyle="-", color="black", lw=max(1, titulo_tam/12)))
    except Exception:
        pass

    # ── Renomeação, ordenação por qtd e estilo de fonte da legenda ───────────
    if com_legenda and tipo_legenda != "Contínua":
        try:
            _leg = ax.get_legend()
            if _leg:
                _handles = list(_leg.legend_handles)
                _labels  = [t.get_text() for t in _leg.get_texts()]
                _tit_txt = _leg.get_title().get_text()

                # Renomeação: suporta label exato ou "label  —  contagem"
                if leg_labels:
                    _renamed = []
                    for _lbl in _labels:
                        _new = _lbl
                        for _k, _v in leg_labels.items():
                            if _lbl == _k:
                                _new = _v; break
                            if _lbl.startswith(_k + "  —  "):
                                _new = _v + "  —  " + _lbl[len(_k) + 5:]; break
                        _renamed.append(_new)
                    _labels = _renamed

                # Ordenação por quantidade (maior → menor)
                def _parse_count(txt):
                    import re as _re
                    # Número BR com pontos de milhar: "3.257", "1.154.000"
                    ms = _re.findall(r'\b\d{1,3}(?:\.\d{3})+\b', txt)
                    if ms:
                        return max(int(m.replace('.', '')) for m in ms)
                    # Número simples
                    ms2 = _re.findall(r'\b\d+\b', txt)
                    if ms2:
                        return max(int(m) for m in ms2)
                    return -1

                _counts = [_parse_count(l) for l in _labels]
                if any(c >= 0 for c in _counts):
                    _sorted = sorted(zip(_handles, _labels, _counts),
                                     key=lambda x: x[2], reverse=True)
                    _handles, _labels = [x[0] for x in _sorted], [x[1] for x in _sorted]

                # Recria legenda com rótulos renomeados e ordenados
                _leg.remove()
                _new_leg = ax.legend(
                    _handles, _labels, title=_tit_txt, loc=loc_leg,
                    frameon=True, framealpha=0.9, fontsize=leg_tam,
                    title_fontsize=leg_tam + 1,
                )
                for _txt in _new_leg.get_texts():
                    _txt.set_fontsize(leg_tam)
                    try: _txt.set_fontfamily(leg_fonte)
                    except Exception: pass
                _new_tit = _new_leg.get_title()
                if _new_tit and _new_tit.get_text():
                    _new_tit.set_fontsize(leg_tam + 1)
                    try: _new_tit.set_fontfamily(leg_fonte)
                    except Exception: pass
        except Exception as _e:
            print(f"[WARN] Legenda (rename/sort/style) falhou: {_e}")

    ax.axis("off")
    buf = io.BytesIO()
    fig.savefig(buf, format=formato_export, dpi=dpi, bbox_inches="tight", facecolor="white")
    buf.seek(0)
    plt.close(fig)
    return buf.read()


# ── Utilitários CSV ────────────────────────────────────────────────────────────

def _listar_abas(raw, nome):
    """Retorna lista de abas para Excel, lista vazia para CSV."""
    if nome.endswith((".xlsx", ".xlsm")):
        try:
            return pd.ExcelFile(io.BytesIO(raw), engine="openpyxl").sheet_names
        except Exception:
            return []
    if nome.endswith(".xls"):
        for eng in ("xlrd", "openpyxl"):
            try:
                return pd.ExcelFile(io.BytesIO(raw), engine=eng).sheet_names
            except Exception:
                continue
    return []


def _detectar_linha_cabecalho(df_raw, max_linhas=30):
    """Retorna o índice da primeira linha com >= 2 células não-vazias."""
    for i in range(min(max_linhas, len(df_raw))):
        if df_raw.iloc[i].notna().sum() >= 2:
            return i
    return 0


def _limpar_colunas_vazias(df):
    """Remove colunas e linhas completamente vazias (tabela não começa na col A ou linha 1)."""
    df = df.dropna(axis=1, how="all")  # colunas vazias
    df = df.dropna(axis=0, how="all")  # linhas vazias entre dados
    df = df.reset_index(drop=True)
    return df


def _ler_csv(arquivo, sheet_name=None):
    nome = arquivo.filename.lower()
    raw  = arquivo.read()

    # ── Excel ──────────────────────────────────────────────────────────────────
    if nome.endswith((".xlsx", ".xlsm")):
        try:
            abas = pd.ExcelFile(io.BytesIO(raw), engine="openpyxl").sheet_names
            aba  = sheet_name if sheet_name in abas else abas[0]
            df_raw = pd.read_excel(io.BytesIO(raw), sheet_name=aba, engine="openpyxl", header=None)
            hr = _detectar_linha_cabecalho(df_raw)
            df = pd.read_excel(io.BytesIO(raw), sheet_name=aba, engine="openpyxl", skiprows=hr)
            return _limpar_colunas_vazias(df)
        except Exception as e:
            raise ValueError(f"Erro ao ler .xlsx/.xlsm: {e}")

    if nome.endswith(".xls"):
        for eng in ("xlrd", "openpyxl"):
            try:
                abas = pd.ExcelFile(io.BytesIO(raw), engine=eng).sheet_names
                aba  = sheet_name if sheet_name in abas else abas[0]
                df_raw = pd.read_excel(io.BytesIO(raw), sheet_name=aba, engine=eng, header=None)
                hr = _detectar_linha_cabecalho(df_raw)
                df = pd.read_excel(io.BytesIO(raw), sheet_name=aba, engine=eng, skiprows=hr)
                return _limpar_colunas_vazias(df)
            except Exception:
                continue
        raise ValueError("Erro ao ler .xls")

    # ── CSV / TXT ───────────────────────────────────────────────────────────────
    encodings = ("utf-8-sig", "utf-8", "latin1", "cp1252", "iso-8859-1")
    separators = (None, ",", ";", "\t", "|")

    for enc in encodings:
        for sep in separators:
            try:
                kwargs = dict(encoding=enc, low_memory=False)
                if sep is None:
                    kwargs["sep"] = None
                    kwargs["engine"] = "python"
                else:
                    kwargs["sep"] = sep
                # Lê sem cabeçalho para detectar linha inicial
                df_raw = pd.read_csv(io.BytesIO(raw), header=None, **kwargs)
                if df_raw.shape[1] < 2:
                    continue
                hr = _detectar_linha_cabecalho(df_raw)
                if sep is None:
                    df = pd.read_csv(io.BytesIO(raw), skiprows=hr, sep=None, engine="python",
                                     encoding=enc, low_memory=False)
                else:
                    df = pd.read_csv(io.BytesIO(raw), skiprows=hr, **kwargs)
                if df.shape[1] >= 2:
                    return _limpar_colunas_vazias(df)
            except Exception:
                continue

    raise ValueError("Não foi possível ler o arquivo. Verifique se é um CSV ou Excel válido.")


def _tratar_numeros_br(df):
    import re
    # Reconhece números do tipo BR: opcional sinal, pontos de milhar, vírgula decimal, ou só vírgula decimal
    padrao = re.compile(r'^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$')
    for col in df.columns:
        if df[col].dtype == object:
            sample = df[col].dropna().astype(str).str.strip()
            sample = sample[sample != ""]
            if len(sample) > 0 and sample.head(50).apply(lambda x: bool(padrao.match(x))).all():
                try:
                    # Limpa pontuação e converte para numérico
                    df[col] = pd.to_numeric(
                        df[col].astype(str).str.replace('.', '', regex=False).str.replace(',', '.', regex=False),
                        errors='coerce'
                    )
                except Exception:
                    pass
    return df


def _detectar_geo(df):
    SIGLAS = {"AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG",
              "MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR",
              "RS","SC","SE","SP","TO"}
    REGIOES = {"norte","nordeste","centro-oeste","sudeste","sul"}
    for col in df.columns:
        sample = df[col].dropna().astype(str).str.strip().unique()[:50]
        vals   = set(sample)
        if vals and all(v.upper() in SIGLAS for v in list(vals)[:10] if len(v) == 2):
            return "uf", col
        if vals and all(normalizar(v) in REGIOES for v in list(vals)[:5]):
            return "regiao", col
        nm = col.lower()
        if any(k in nm for k in ("municipio","município","cidade","nm_mun","cd_mun")):
            return "municipio", col
        if any(k in nm for k in ("uf","estado","sigla_uf")):
            return "uf", col
        if any(k in nm for k in ("regiao","região","nm_regiao")):
            return "regiao", col
    return "uf", (df.columns[0] if len(df.columns) else "")


# ── Start ──────────────────────────────────────────────────────────────────────
def preaquecer():
    """Carrega as geometrias em background para a primeira requisição não pagar o custo."""
    for n in ("uf", "municipio"):
        threading.Thread(target=get_gdf, args=(n,), daemon=True).start()


if __name__ == "__main__":
    porta = int(os.environ.get("PORT", 5000))
    preaquecer()
    print("=" * 50)
    print("  CNM Sistema de Mapas")
    print(f"  Acesse: http://localhost:{porta}")
    print("=" * 50)
    from waitress import serve
    serve(app, host="0.0.0.0", port=porta, threads=4)
