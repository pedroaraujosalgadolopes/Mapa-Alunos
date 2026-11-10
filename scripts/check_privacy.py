#!/usr/bin/env python3
"""Falha se dado pessoal ou bruto aparecer em arquivos versionados.

Uso:
  python scripts/check_privacy.py            # todos os arquivos rastreados (CI)
  python scripts/check_privacy.py --staged   # só o que está no stage (pre-commit)

Regras: sem PDF/planilha/banco/.env; sem pastas de dados reais; CSV só onde é permitido;
sem número de inscrição (5 dígitos isolados). Inscrições FALSAS usam a faixa 99000-99999.
Linha com o marcador `privacy-ok` é ignorada.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import PurePosixPath

PREFIXOS_PROIBIDOS = ("data/raw/", "data/private/", "data/snapshots/")
EXATOS_PROIBIDOS = {"data/public/resumo.json", "data/public/pendencias.md", "data/public/nomes.json"}  # derivados de dado real
EXT_PROIBIDAS = {".pdf", ".xlsx", ".xls", ".xlsm", ".db", ".sqlite", ".sqlite3", ".parquet"}
CSV_PERMITIDO_PREFIXOS = ("data/reference/", "data/synthetic/", "pipeline/tests/fixtures/")
CSV_PERMITIDO_EXATOS = {"data/public/instituicoes_flat.csv"}
IGNORAR_CONTEUDO = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock"}
INSCRICAO = re.compile(r"(?<![\w.,/-])\d{5}(?![\w.,/-])")
FALSA = re.compile(r"99\d{3}")
MAX_BYTES = 2_000_000


def analisar(caminho: str, conteudo: bytes | None) -> list[str]:
    """Devolve a lista de violações de um arquivo (vazia se estiver ok)."""
    erros: list[str] = []
    p = PurePosixPath(caminho)
    nome, ext = p.name, p.suffix.lower()
    if caminho.startswith(PREFIXOS_PROIBIDOS) or caminho in EXATOS_PROIBIDOS:
        erros.append("pasta/arquivo de dados reais não pode ser versionado")
    if ext in EXT_PROIBIDAS:
        erros.append(f"extensão proibida ({ext})")
    if nome.startswith(".env") and nome != ".env.example":
        erros.append("arquivo .env não pode ser versionado")
    if ext == ".csv" and not (caminho.startswith(CSV_PERMITIDO_PREFIXOS) or caminho in CSV_PERMITIDO_EXATOS):
        erros.append("CSV fora das pastas permitidas (data/reference, data/synthetic)")
    if conteudo is None or nome in IGNORAR_CONTEUDO or len(conteudo) > MAX_BYTES:
        return erros
    try:
        texto = conteudo.decode("utf8")
    except UnicodeDecodeError:
        return erros  # binário (imagem, fonte)
    for n, linha in enumerate(texto.splitlines(), 1):
        if "privacy-ok" in linha:
            continue
        for m in INSCRICAO.finditer(linha):
            if not FALSA.fullmatch(m[0]):
                erros.append(f"linha {n}: padrão de número de inscrição (5 dígitos isolados)")
                break
    return erros


def _git(*args: str, texto: bool = True):
    return subprocess.run(["git", *args], capture_output=True, text=texto, check=True).stdout


def main(argv: list[str]) -> int:
    staged = "--staged" in argv
    if staged:
        arquivos = _git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0")
    else:
        arquivos = _git("ls-files", "-z").split("\0")
    falhas = 0
    for f in filter(None, arquivos):
        try:
            conteudo = _git("show", f":{f}", texto=False) if staged else open(f, "rb").read()
        except (subprocess.CalledProcessError, OSError):
            conteudo = None
        for e in analisar(f, conteudo):
            print(f"[privacidade] {f}: {e}", file=sys.stderr)
            falhas += 1
    if falhas:
        print(f"\n{falhas} violação(ões). Dados reais ficam em data/raw, data/private e data/snapshots (fora do git).",
              file=sys.stderr)
        return 1
    print("check_privacy: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
