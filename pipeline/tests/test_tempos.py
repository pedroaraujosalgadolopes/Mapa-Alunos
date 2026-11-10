import csv
import urllib.error
from datetime import date
from pathlib import Path

import pytest

from uffmap import tempos
from uffmap.normalize import Referencia

DATA = Path(__file__).parent.parent.parent / "data"
REF = Referencia(DATA / "reference")
CFG = tempos.Config(contato="teste@example.org", pausa_s=0)
ALVO = {c["cidade_id"]: c for c in tempos.cidades_alvo(REF)}


def parada(cid, dur_s, k=2, dlat=0.0):
    c = ALVO[cid]
    return {"place": {"name": "Estação", "lat": float(c["lat"]) + dlat, "lon": float(c["lon"])}, "duration": dur_s, "k": k}


def test_so_regioes_ativas_com_instituicao():
    assert "porto" in ALVO and "bogota" not in ALVO
    assert all(REF.regiao_ativa(k) for k in ALVO)


def test_quarta_de_referencia():
    q = tempos.quarta_de_referencia(date(2026, 11, 10))  # terça
    assert q == "2026-11-18T07:00:00Z" and date.fromisoformat(q[:10]).weekday() == 2


def test_linhas_ok_sem_dado_e_filtro_de_raio():
    resp = {"all": [parada("coimbra", 60), parada("braga", 120, dlat=0.5)]}  # braga: parada a ~55 km do centro
    linhas = {l["destino_cidade_id"]: l for l in tempos.linhas_da_origem(resp, ALVO["porto"], list(ALVO.values()), CFG, "q", date(2026, 1, 1))}
    assert linhas["coimbra"]["minutos"] == 60 and linhas["coimbra"]["status"] == "ok" and linhas["coimbra"]["transferencias"] == 1
    assert linhas["braga"]["status"] == "sem_dado" and linhas["braga"]["minutos"] == ""  # nunca inventa
    assert "porto" not in linhas and linhas["coimbra"]["fonte"] == "transitous" and linhas["coimbra"]["modo"] == "trem_onibus"


def test_k_zero_nao_conta_como_conexao():
    resp = {"all": [parada("coimbra", 10, k=0)]}
    l = {x["destino_cidade_id"]: x for x in tempos.linhas_da_origem(resp, ALVO["porto"], [ALVO["coimbra"]], CFG, "q", date(2026, 1, 1))}
    assert l["coimbra"]["status"] == "sem_dado"


def test_recusa_sem_contato():
    with pytest.raises(SystemExit):
        tempos.rodar(DATA, tempos.Config(contato=" "))


def test_dry_run_nao_usa_rede(tmp_path):
    def proibido(*a):
        raise AssertionError("rede")
    out = tempos.rodar(montar(tmp_path), CFG, dry_run=True, fetch=proibido)  # pasta isolada: ignora o cache real
    assert out["dry_run"] and out["origens_a_consultar"] == len(ALVO)


def montar(tmp_path):
    (tmp_path / "reference").mkdir(parents=True)
    for f in DATA.joinpath("reference").glob("*.csv"):
        (tmp_path / "reference" / f.name).write_text(f.read_text(encoding="utf8"), encoding="utf8")
    return tmp_path


def test_cache_progresso_e_429(tmp_path):
    data = montar(tmp_path)
    chamadas = []

    def fetch(url, contato):
        chamadas.append(url)
        assert contato == "teste@example.org"
        if len(chamadas) == 3:
            raise urllib.error.HTTPError(url, 429, "slow down", {}, None)
        return {"all": [parada("coimbra", 60)]}

    out = tempos.rodar(data, CFG, hoje=date(2026, 1, 1), fetch=fetch, dormir=lambda s: None)
    assert out["consultadas"] == 2 and out["falhas"] == ["augsburg: HTTP 429"]  # 3ª origem em ordem alfabética
    assert len(chamadas) == 3  # parou no 429 e guardou o progresso
    linhas = list(csv.DictReader(open(data / "reference" / "tempos" / "tempos.csv", encoding="utf8")))
    assert len({l["origem_cidade_id"] for l in linhas}) == 2
    # segunda rodada: só faltantes (as 2 primeiras estão no cache)
    chamadas.clear()
    out2 = tempos.rodar(data, CFG, hoje=date(2026, 1, 2), dry_run=True)
    assert out2["em_cache"] == 2 and out2["origens_a_consultar"] == len(ALVO) - 2


def test_tempos_simulados_so_no_sintetico(tmp_path):
    from uffmap.sintetico import tempos_simulados
    data = montar(tmp_path)
    n = tempos_simulados(data)
    linhas = list(csv.DictReader(open(data / "synthetic" / "tempos.csv", encoding="utf8")))
    assert n == len(linhas) > 1000
    assert {l["fonte"] for l in linhas} == {"simulado"} and all("SIMULADO" in l["metodo"] for l in linhas)
    assert {"ok", "sem_dado", "alem_do_limite"} <= {l["status"] for l in linhas}
    assert not (data / "reference" / "tempos" / "tempos.csv").exists()  # o dado real nunca recebe simulação


def test_voos_estimados_marcados_e_com_limite_de_distancia(tmp_path):
    destino = tmp_path / "voos.csv"
    n = tempos.voos_estimados(REF, destino, hoje=date(2026, 1, 1))
    linhas = list(csv.DictReader(open(destino, encoding="utf8")))
    assert n == len(linhas) > 500
    assert {l["modo"] for l in linhas} == {"voo_estimado"} and {l["status"] for l in linhas} == {"estimado"}
    assert {l["fonte"] for l in linhas} == {"estimativa"} and all("ESTIMATIVA" in l["metodo"] for l in linhas)
    pares = {(l["origem_cidade_id"], l["destino_cidade_id"]): int(l["minutos"]) for l in linhas}
    assert ("porto", "coimbra") not in pares  # ~100 km: sem voo estimado
    lisboa_estocolmo = pares[("lisboa", "stockholm")]  # ~3.000 km: 3.000/750*60 + 180 ≈ 419 min
    assert 400 < lisboa_estocolmo < 440 and pares[("stockholm", "lisboa")] == lisboa_estocolmo  # simétrico


def test_onibus_estimado_so_trechos_curtos_e_marcado(tmp_path):
    destino = tmp_path / "onibus.csv"
    n = tempos.onibus_estimados(REF, destino, hoje=date(2026, 1, 1))
    linhas = list(csv.DictReader(open(destino, encoding="utf8")))
    assert n == len(linhas) > 100
    assert {l["modo"] for l in linhas} == {"onibus_estimado"} and {l["status"] for l in linhas} == {"estimado"}
    assert {l["fonte"] for l in linhas} == {"estimativa"} and all("ESTIMATIVA" in l["metodo"] for l in linhas)
    pares = {(l["origem_cidade_id"], l["destino_cidade_id"]): int(l["minutos"]) for l in linhas}
    assert 100 < pares[("logrono", "pamplona")] < 160  # ~90 km: antes o dado aberto dava 451 min
    assert ("lisboa", "stockholm") not in pares  # longe demais para ônibus estimado
    assert pares[("pamplona", "logrono")] == pares[("logrono", "pamplona")]
