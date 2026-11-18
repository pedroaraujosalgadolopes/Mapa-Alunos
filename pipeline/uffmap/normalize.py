"""Normalização de nomes, cursos e instituições."""
from __future__ import annotations

import csv
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

PREFIXO_MIN = 25  # tamanho mínimo (caracteres dobrados) para aceitar texto truncado como prefixo
SUBSEQ_MIN = 20  # idem para texto embaralhado (subsequência)
SUBSEQ_SOBRA = 30  # caracteres extras tolerados no texto embaralhado


def fold(s: str) -> str:
    """minúsculas, sem acentos nem pontuação, espaços colapsados."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9 ]+", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def slug(s: str) -> str:
    return fold(s).replace(" ", "-")


def normaliza_nome(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.replace("*", "")).strip().title()


_RE_CAMPUS = re.compile(r"\s*\(\s*([^)]+?)\s*\)\s*$")


def normaliza_curso(raw: str) -> tuple[str, str | None]:
    """Separa o campus de origem na UFF: 'Direito ( Macaé)' -> ('Direito', 'Macaé')."""
    raw = re.sub(r"\s+", " ", raw).strip()
    m = _RE_CAMPUS.search(raw)
    campus = m[1].strip() if m else None
    if m:
        raw = raw[: m.start()].strip()
    raw = re.sub(r"^Eng\b\.?", "Engenharia", raw)
    return raw, campus


def parse_nota(raw: str) -> float:
    return float(raw.replace(",", "."))


@dataclass
class Resolucao:
    instituicao_id: str
    metodo: str  # exato | prefixo | subsequencia | desconhecida | sem_destino
    flags: tuple[str, ...] = ()


def _subseq(chave: str, texto: str) -> bool:
    it = iter(texto)
    return all(c in it for c in chave)


AREA_OUTRAS = "Outras áreas"


class Referencia:
    """Cidades, instituições e aliases lidos de data/reference (nada fixo no código)."""

    def __init__(self, ref_dir: Path):
        rd = lambda n: list(csv.DictReader(open(ref_dir / n, encoding="utf8")))
        self.regioes = {r["regiao_id"]: r for r in rd("regioes.csv")}
        self.cidades = {r["cidade_id"]: r for r in rd("cidades.csv")}
        self.instituicoes = {r["instituicao_id"]: r for r in rd("instituicoes.csv")}
        self.aliases_obs: dict[str, tuple[str, str]] = {}
        self._chaves: dict[str, str] = {}
        self.grafias: list[tuple[str, str]] = []  # (grafia original, instituicao_id)
        for i in self.instituicoes.values():
            self._chaves[fold(i["nome"])] = i["instituicao_id"]
            self.grafias.append((i["nome"], i["instituicao_id"]))
        for a in rd("aliases.csv"):
            self._chaves[fold(a["alias"])] = a["instituicao_id"]
            self.grafias.append((a["alias"], a["instituicao_id"]))
            if a["observacao"]:
                self.aliases_obs[a["instituicao_id"]] = (a["alias"], a["observacao"])

        # área de interesse por curso (areas.csv é uma classificação editorial, revisável por PR)
        f_areas = ref_dir / "areas.csv"
        self.areas = {fold(r["curso"]): r["area"] for r in rd("areas.csv")} if f_areas.exists() else {}

    def area(self, curso: str) -> str:
        return self.areas.get(fold(curso), AREA_OUTRAS)

    def regiao_ativa(self, cidade_id: str | None) -> bool:
        c = self.cidades.get(cidade_id or "")
        return bool(c) and self.regioes[c["regiao_id"]]["ativa"] == "sim"

    def resolver(self, raw: str) -> Resolucao:
        flags: list[str] = []
        txt = re.sub(r"\s+", " ", raw.replace("*", "")).strip()
        m = re.search(r"\s*-\s*pendente\b.*$", txt, re.I)  # status colado ao nome
        if m:
            flags.append("proficiencia_pendente")
            txt = txt[: m.start()].strip()
        f = fold(txt)
        if f.startswith("sem vaga"):
            return Resolucao("sem-destino", "sem_destino", tuple(flags))
        if f in self._chaves:
            return Resolucao(self._chaves[f], "exato", tuple(flags))
        # texto quebrado entre páginas no PDF: prefixo único
        if len(f) >= PREFIXO_MIN:
            ids = {i for k, i in self._chaves.items() if k.startswith(f)}
            if len(ids) == 1:
                return Resolucao(ids.pop(), "prefixo", tuple(flags))
        # texto embaralhado por sobreposição de linhas: nome conhecido como subsequência única
        fs = f.replace(" ", "")
        ids = {i for k, i in self._chaves.items()
               if len(k) >= SUBSEQ_MIN and len(fs) <= len(k) + SUBSEQ_SOBRA and _subseq(k.replace(" ", ""), fs)}
        if len(ids) == 1:
            return Resolucao(ids.pop(), "subsequencia", tuple(flags))
        return Resolucao(f"pendente-{slug(txt)}", "desconhecida", tuple(flags))
