"""Extrai linhas dos PDFs de alocação a partir da posição das palavras.

Por que não usar as tabelas do pdfplumber: as bordas das células não coincidem com as colunas
(o texto transborda: "Reis) 10,29", "Ambiente6,84"). A ordem das colunas também muda entre
PDFs (excedentes tem o semestre antes do nome). Então:
  * cada linha é ancorada na palavra de 5 dígitos (nº de inscrição) da coluna mais à esquerda;
  * semestre = palavra 20dd.d; nota = primeira palavra numérica depois do nome (ou colada no
    fim da última palavra do curso);
  * curso = palavras à esquerda da nota; instituição = palavras à direita; nome = palavras
    da primeira linha à esquerda da coluna do curso.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

RE_INSCRICAO = re.compile(r"\d{5}")
RE_SEMESTRE = re.compile(r"20\d\d\.\d")
RE_NOTA = re.compile(r"\d{1,2}(?:,\d{1,2})?")
# Nota colada na última palavra do curso: "Ambiente6,84", "Redonda)8,08" e o caso em que o PDF
# troca a ordem dos glifos ("Redonda8),08" em vez de "Redonda)8,08").
RE_NOTA_COLADA = re.compile(r"^(.*[^\d,])(\d{1,2})(\))?(,\d{1,2})$")


@dataclass
class RawRow:
    fonte: str  # nome do arquivo PDF
    pagina: int
    inscricao: str
    nome: str
    curso: str
    pontuacao: str
    instituicao: str
    semestre: str


@dataclass
class Extraction:
    rows: list[RawRow] = field(default_factory=list)
    rejeitadas: list[str] = field(default_factory=list)  # descrição sem dados pessoais


def _join(words: list[dict]) -> str:
    # leitura: linha a linha (tolerância de 3pt em `top`), da esquerda para a direita
    ws = sorted(words, key=lambda w: (round(w["top"] / 3), w["x0"]))
    return " ".join(w["text"] for w in ws)


def parse_words(words: list[dict], fonte: str, pagina: int, out: Extraction | None = None) -> Extraction:
    """`words`: dicts com text, x0, x1, top (formato de pdfplumber.extract_words)."""
    out = out or Extraction()
    cands = [w for w in words if RE_INSCRICAO.fullmatch(w["text"])]
    if not cands:
        return out
    left = min(w["x0"] for w in cands)
    anchors = sorted((w for w in cands if w["x0"] - left < 5), key=lambda w: w["top"])

    parsed = []  # (inscrição, semestre, nota, palavras de nome+curso, palavras da instituição)
    for i, a in enumerate(anchors):
        # a faixa vertical da linha vai até o ponto médio entre inscrições (células centralizadas)
        lo = a["top"] - 9 if i == 0 else (anchors[i - 1]["top"] + a["top"]) / 2
        hi = a["top"] + 10 if i == len(anchors) - 1 else (a["top"] + anchors[i + 1]["top"]) / 2
        ws = [w for w in words if lo <= w["top"] < hi and w is not a]
        sem_w = next((w for w in ws if RE_SEMESTRE.fullmatch(w["text"])), None)
        if sem_w is None:
            out.rejeitadas.append(f"{fonte} p.{pagina}: linha sem semestre reconhecível")
            continue
        rest = sorted((w for w in ws if w is not sem_w), key=lambda w: w["x0"])
        nota_w = next((w for w in rest if RE_NOTA.fullmatch(w["text"])), None)
        if nota_w is not None:
            nota, x0, x1 = nota_w["text"], nota_w["x0"], nota_w["x1"]
            left_ws = [w for w in rest if w["x0"] < x0 - 0.5]
        else:  # nota colada no fim da última palavra do curso
            glued = next((w for w in rest if RE_NOTA_COLADA.match(w["text"])), None)
            if glued is None:
                out.rejeitadas.append(f"{fonte} p.{pagina}: linha sem nota reconhecível")
                continue
            m = RE_NOTA_COLADA.match(glued["text"])
            nota, x0, x1 = m[2] + m[4], glued["x0"], glued["x1"]
            left_ws = [dict(glued, text=m[1] + (m[3] or "")) if w is glued else w for w in rest if w["x1"] <= x0 + 0.5 or w is glued]
            rest = [w for w in rest if w is not glued]
        inst_ws = [w for w in rest if w["x0"] >= x1 - 0.5]
        parsed.append((a["text"], sem_w["text"], nota, left_ws, inst_ws))

    # o curso começa na coluna (x0) mais comum da 2ª palavra de cada linha; antes dela é o nome
    xs = Counter(round(sorted(p[3], key=lambda w: w["x0"])[1]["x0"]) for p in parsed if len(p[3]) > 1)
    curso_x = (xs.most_common(1)[0][0] if xs else 0) - 2
    for insc, sem, nota, left_ws, inst_ws in parsed:
        nome = _join([w for w in left_ws if w["x0"] < curso_x])
        curso = _join([w for w in left_ws if w["x0"] >= curso_x])
        out.rows.append(RawRow(fonte, pagina, insc, nome, curso, nota, _join(inst_ws), sem))
    return out


def extract_pdf(path: Path) -> Extraction:
    out = Extraction()
    with pdfplumber.open(path) as pdf:
        for n, page in enumerate(pdf.pages, start=1):
            parse_words(page.extract_words(), path.name, n, out)
    return out
