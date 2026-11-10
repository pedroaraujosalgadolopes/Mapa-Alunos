import csv
import json
import re
from datetime import date
from pathlib import Path

import pytest

from uffmap import snapshot
from uffmap.sintetico import gerar_pdfs

DATA = Path(__file__).parent.parent.parent / "data"


@pytest.fixture()
def rodada(tmp_path):
    verdade = gerar_pdfs(tmp_path / "pdfs")
    out = snapshot.rodar(tmp_path / "pdfs", DATA, hoje=date(2026, 1, 1), base=tmp_path / "saida")
    return verdade, out, tmp_path / "saida"


def test_merge_por_inscricao(rodada):
    verdade, out, base = rodada
    rows = list(csv.DictReader(open(base / "private" / "alunos.csv", encoding="utf8")))
    assert out["ativos"] == verdade["ativos"] + 1  # 90 + a aluna do "Sem vaga", que ganhou destino no excedentes
    por = {}
    for r in rows:
        por.setdefault(r["inscricao"], []).append(r)
    trocado = por[verdade["inscricao_trocada"]]
    assert sorted(r["status"] for r in trocado) == ["ativo", "substituido"]  # casa por inscrição, não por nome
    assert [r["status"] for r in por["99901"]].count("ativo") == 1 and "sem_vaga" not in {r["status"] for r in rows}


def test_instituicao_desconhecida_nao_quebra(rodada):
    _, out, base = rodada
    assert out["resolucao"]["desconhecida"] == 1
    assert "Universidade Ficticia de Teste" in (base / "public" / "pendencias.md").read_text(encoding="utf8")
    res = json.loads((base / "public" / "resumo.json").read_text(encoding="utf8"))
    assert any(c["cidade_id"] == "pendente" for c in res["cidades"])


def test_saidas_publicas_sem_nome_nem_inscricao(rodada):
    _, _, base = rodada
    priv = list(csv.DictReader(open(base / "private" / "alunos.csv", encoding="utf8")))
    texto = "".join((base / "public" / f).read_text(encoding="utf8") for f in ("resumo.json", "pendencias.md"))
    assert not any(r["inscricao"] in texto for r in priv)
    assert not re.search(r"\b(Alfa|Bravo|Charlie|Zulu)\b", texto)


def test_grupo_pequeno_sem_curso(rodada):
    _, _, base = rodada
    res = json.loads((base / "public" / "resumo.json").read_text(encoding="utf8"))
    grupos = [i for c in res["cidades"] for i in c["instituicoes"]]
    assert any(g["total"] < 3 for g in grupos) and any(g["total"] >= 3 for g in grupos)
    for g in grupos:
        assert (g["cursos"] is None) == (g["total"] < 3)
        assert (g["cursos_por_semestre"] is None) == (g["total"] < 3)


def test_diferencas_entre_rodadas(rodada, tmp_path):
    verdade, _, base = rodada
    antigas = list(csv.DictReader(open(base / "private" / "alunos.csv", encoding="utf8")))
    novas = [dict(l) for l in antigas]
    ativo = next(l for l in novas if l["status"] == "ativo" and l["inscricao"] != "99901")
    ativo["instituicao_id"] = "mudou"
    novas = [l for l in novas if l["inscricao"] != "99002"] + [dict(ativo, inscricao="99777")]
    d = snapshot.diferencas(antigas, novas)
    assert d["entrou"] == ["99777"] and "99002" in d["saiu"] and ativo["inscricao"] in d["destino"]


def test_reconstruir_nao_le_pdfs(rodada):
    _, _, base = rodada
    out = snapshot.reconstruir(DATA, base=base)
    assert out["ativos"] > 0


def test_nomes_por_grupo_ordenados_e_sem_inscricao(rodada):
    _, _, base = rodada
    nomes = json.loads((base / "public" / "nomes.json").read_text(encoding="utf8"))
    for sem in nomes.values():
        for pessoas in sem.values():
            ns = [p["nome"] for p in pessoas]
            assert ns == sorted(ns, key=str.casefold)  # ordem alfabética: não revela a nota
            assert all(set(p) == {"nome", "curso", "campus_origem"} for p in pessoas)
    assert not re.search(r"\d{5}", json.dumps(nomes))
    total = sum(len(l) for sem in nomes.values() for l in sem.values())
    assert total == json.loads((base / "public" / "resumo.json").read_text(encoding="utf8"))["total"]
