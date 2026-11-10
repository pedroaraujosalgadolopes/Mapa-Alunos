"""Tempos de viagem entre cidades (trem/ônibus) via Transitous (MOTIS), com cache em CSV.

Uma chamada `one-to-all` por cidade de origem (poucas dezenas por rodada; o limite de uso justo é 720/dia).
O tempo até uma cidade é o da parada de transporte mais rápida num raio do centro dela. Nada é inventado:
sem parada alcançável = `sem_dado`; acima do limite de horas = `alem_do_limite`.
Cada linha guarda fonte, modo, data de referência e quando foi consultada.
"""
from __future__ import annotations

import csv
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from .normalize import Referencia

BASE = "https://api.transitous.org"
VERSAO = "0.1"
COLUNAS = ["origem_cidade_id", "destino_cidade_id", "modo", "minutos", "status", "transferencias",
           "parada_dist_m", "fonte", "metodo", "referencia", "consultado_em"]
MODO = "trem_onibus"
FONTE = "transitous"


@dataclass
class Config:
    contato: str
    max_min: int = 600  # acima disso: alem_do_limite
    raio_parada_m: int = 2000
    pausa_s: float = 3.0
    validade_dias: int = 30
    base: str = BASE


def user_agent(contato: str) -> str:
    return f"rede-apoio-intercambio-uff/{VERSAO} (projeto open source sem fins lucrativos; contato: {contato})"


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def quarta_de_referencia(hoje: date, hora_utc: str = "07:00") -> str:
    """Próxima quarta-feira com pelo menos 3 dias de antecedência (dia útil típico), em ISO UTC."""
    d = hoje + timedelta(days=3)
    d += timedelta(days=(2 - d.weekday()) % 7)
    return f"{d.isoformat()}T{hora_utc}:00Z"


def cidades_alvo(ref: Referencia) -> list[dict]:
    """Cidades de regiões ativas que têm ao menos uma instituição (nada fixo no código)."""
    com_inst = {i["cidade_id"] for i in ref.instituicoes.values()}
    return [c for k, c in sorted(ref.cidades.items()) if k in com_inst and ref.regiao_ativa(k)]


def http_get(url: str, contato: str, timeout: int = 180) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": user_agent(contato), "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def url_one_to_all(cfg: Config, origem: dict, quando: str) -> str:
    q = {"one": f"{origem['lat']},{origem['lon']}", "maxTravelTime": cfg.max_min, "time": quando,
         "maxPreTransitTime": 1800, "maxPostTransitTime": 900, "maxMatchingDistance": 1000}
    return f"{cfg.base}/api/v6/one-to-all?{urllib.parse.urlencode(q, safe=',')}"


def linhas_da_origem(resp: dict, origem: dict, destinos: list[dict], cfg: Config, quando: str, hoje: date) -> list[dict]:
    """Converte a resposta de uma origem em linhas (uma por cidade de destino)."""
    paradas = [(p["place"], p["duration"], p.get("k", 0)) for p in resp.get("all", []) if p.get("k", 0) > 0]
    out = []
    for d in destinos:
        if d["cidade_id"] == origem["cidade_id"]:
            continue
        centro = (float(d["lat"]), float(d["lon"]))
        melhores = []
        for pl, dur, k in paradas:
            dist = haversine_m(centro, (pl["lat"], pl["lon"]))
            if dist <= cfg.raio_parada_m:
                melhores.append((dur, dist, k))
        base = {"origem_cidade_id": origem["cidade_id"], "destino_cidade_id": d["cidade_id"], "modo": MODO, "fonte": FONTE,
                "referencia": quando, "consultado_em": hoje.isoformat()}
        if melhores:
            dur, dist, k = min(melhores)
            out.append({**base, "minutos": round(dur / 60), "status": "ok", "transferencias": max(k - 1, 0),
                        "parada_dist_m": round(dist), "metodo": f"one-to-all; parada mais rápida a até {cfg.raio_parada_m} m do centro"})
        else:
            out.append({**base, "minutos": "", "status": "sem_dado", "transferencias": "", "parada_dist_m": "",
                        "metodo": f"one-to-all; nenhuma parada alcançável em {cfg.max_min} min a até {cfg.raio_parada_m} m do centro"})
    return out


def le_cache(arq: Path) -> list[dict]:
    return list(csv.DictReader(open(arq, encoding="utf8"))) if arq.exists() else []


def grava(arq: Path, linhas: list[dict]):
    arq.parent.mkdir(parents=True, exist_ok=True)
    with open(arq, "w", encoding="utf8", newline="") as f:
        w = csv.DictWriter(f, COLUNAS)
        w.writeheader()
        w.writerows(sorted(linhas, key=lambda l: (l["origem_cidade_id"], l["destino_cidade_id"])))


def pendentes(cache: list[dict], origens: list[dict], hoje: date, cfg: Config, forcar: bool) -> list[dict]:
    """Origens sem consulta recente (cache vale `validade_dias`)."""
    if forcar:
        return origens
    recente = {}
    for l in cache:
        recente[l["origem_cidade_id"]] = max(recente.get(l["origem_cidade_id"], ""), l["consultado_em"])
    corte = (hoje - timedelta(days=cfg.validade_dias)).isoformat()
    return [o for o in origens if recente.get(o["cidade_id"], "") < corte]


def rodar(data: Path, cfg: Config, hoje: date | None = None, forcar: bool = False, so_origem: str | None = None,
          dry_run: bool = False, fetch: Callable[[str, str], dict] | None = None, dormir: Callable[[float], None] = time.sleep) -> dict:
    if not cfg.contato.strip():
        raise SystemExit("Informe o contato do User-Agent (e-mail ou site): --contato ou TRANSITOUS_CONTACT. "
                         "A política do Transitous exige.")
    hoje = hoje or date.today()
    ref = Referencia(data / "reference")
    alvo = cidades_alvo(ref)
    arq = data / "reference" / "tempos" / "tempos.csv"
    cache = le_cache(arq)
    todas = [o for o in alvo if not so_origem or o["cidade_id"] == so_origem]
    fazer = pendentes(cache, todas, hoje, cfg, forcar)
    quando = quarta_de_referencia(hoje)
    resumo = {"cidades": len(alvo), "origens_a_consultar": len(fazer), "referencia": quando, "em_cache": len(todas) - len(fazer)}
    if dry_run:
        return {**resumo, "dry_run": True}
    fetch = fetch or (lambda url, contato: http_get(url, contato))
    mantidas = [l for l in cache if l["origem_cidade_id"] not in {o["cidade_id"] for o in fazer}]
    novas: list[dict] = []
    falhas = []
    for n, o in enumerate(fazer):
        try:
            resp = fetch(url_one_to_all(cfg, o, quando), cfg.contato)
        except urllib.error.HTTPError as e:
            falhas.append(f"{o['cidade_id']}: HTTP {e.code}")
            if e.code == 429:  # pediram para desacelerar: para tudo e guarda o que já temos
                break
            continue
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            falhas.append(f"{o['cidade_id']}: {type(e).__name__}")
            continue
        novas += linhas_da_origem(resp, o, alvo, cfg, quando, hoje)
        grava(arq, mantidas + novas)  # progresso salvo a cada origem
        if n < len(fazer) - 1:
            dormir(cfg.pausa_s)
    grava(arq, mantidas + novas)
    todas_linhas = mantidas + novas
    st = {}
    for l in todas_linhas:
        st[l["status"]] = st.get(l["status"], 0) + 1
    return {**resumo, "consultadas": len({l["origem_cidade_id"] for l in novas}), "falhas": falhas, "linhas": len(todas_linhas), "por_status": st}
