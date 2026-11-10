"""Visão achatada das instituições (uma linha por grafia) para revisar em planilha.

Gerada só a partir de data/reference. A edição continua nos arquivos normalizados.
"""
from __future__ import annotations

import csv
from pathlib import Path

from .normalize import Referencia

COLUNAS = ["grafia", "instituicao", "cidade", "pais", "campus", "status", "campus_status"]


def gerar(ref: Referencia, destino: Path) -> int:
    linhas = []
    for grafia, iid in ref.grafias:
        i = ref.instituicoes[iid]
        c = ref.cidades[i["cidade_id"]]
        linhas.append([grafia, i["nome"], c["cidade"], c["pais"], i["campus"], i["status"], i["campus_status"]])
    destino.parent.mkdir(parents=True, exist_ok=True)
    with open(destino, "w", encoding="utf8", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLUNAS)
        w.writerows(sorted(set(map(tuple, linhas))))
    return len(linhas)
