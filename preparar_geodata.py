"""Converte os shapefiles do IBGE em GeoParquet pré-simplificado.

Os shapefiles brutos ocupam ~336 MB e levam ~25 s para carregar; o Parquet
equivalente, já reprojetado e simplificado com a mesma tolerância que o app
aplicava em runtime, ocupa ~7 MB e carrega em menos de 1 s. Só o Parquet vai
para o Git — os shapefiles continuam ignorados.

Rode este script sempre que trocar os shapefiles de ano:

    python preparar_geodata.py
"""
import os
import time

import geopandas as gpd

from app import GEO_DIR, SHP_NOMES, ler_shapefile


def main() -> None:
    os.makedirs(GEO_DIR, exist_ok=True)
    for nivel in SHP_NOMES:
        t0 = time.time()
        gdf = ler_shapefile(nivel)
        destino = os.path.join(GEO_DIR, f"{nivel}.parquet")
        gdf.to_parquet(destino, compression="zstd", index=False)
        mb = os.path.getsize(destino) / 1e6
        print(f"{nivel:10s} {len(gdf):5d} feições → {destino} ({mb:.1f} MB, {time.time() - t0:.1f}s)")


if __name__ == "__main__":
    main()
