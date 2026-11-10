"""Monta o snapshot: merge por inscrição, CSV privado, saídas públicas agregadas e pendências."""
from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
import tomllib
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from .extract import extract_pdf
from .normalize import Referencia, normaliza_curso, normaliza_nome

K_MIN = 3  # grupos (cidade + instituição) menores só mostram a contagem
RE_SEMESTRE = re.compile(r"^\d{4}\.[12]$")
COLUNAS = ["edital", "inscricao", "primeiro_nome", "curso", "campus_origem", "instituicao_raw",
           "instituicao_id", "semestre", "arquivo_origem", "status", "snapshot"]


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def _le_csv(p: Path) -> list[dict]:
    return list(csv.DictReader(open(p, encoding="utf8"))) if p.exists() else []


def extrair(pdfs: Path, fontes: dict, ref: Referencia, snap: str):
    """Lê os PDFs e devolve (linhas, hashes, rejeitadas). Só roda numa nova rodada de snapshot."""
    linhas, hashes, rej = [], {}, []
    for f in fontes["fonte"]:
        p = pdfs / f["arquivo"]
        if not p.exists():
            rej.append(f"arquivo ausente: {f['arquivo']}")
            continue
        hashes[f["arquivo"]] = _sha(p)
        if f["tipo"] != "alocacao":
            continue
        ex = extract_pdf(p)
        rej += ex.rejeitadas
        for r in ex.rows:
            curso, campus = normaliza_curso(r.curso)
            linhas.append({
                "edital": fontes["edital"], "inscricao": r.inscricao, "primeiro_nome": normaliza_nome(r.nome),
                "curso": curso, "campus_origem": campus or "", "instituicao_raw": r.instituicao,
                "instituicao_id": ref.resolver(r.instituicao).instituicao_id, "semestre": r.semestre,
                "arquivo_origem": f["arquivo"], "status": "", "snapshot": snap, "_rodada": f["rodada"]})
    # mesma inscrição: vale a rodada mais recente; as anteriores ficam como substituido
    por_insc = defaultdict(list)
    for l in linhas:
        por_insc[l["inscricao"]].append(l)
    for ls in por_insc.values():
        ls.sort(key=lambda l: l["_rodada"])
        for l in ls[:-1]:
            l["status"] = "substituido"
        ls[-1]["status"] = "sem_vaga" if ls[-1]["instituicao_id"] == "sem-destino" else "ativo"
    return linhas, hashes, rej


def diferencas(antigas: list[dict], novas: list[dict]) -> dict:
    a = {l["inscricao"]: l for l in antigas if l["status"] == "ativo"}
    n = {l["inscricao"]: l for l in novas if l["status"] == "ativo"}
    return {"entrou": sorted(n.keys() - a.keys()), "saiu": sorted(a.keys() - n.keys()),
            "destino": sorted(k for k in a.keys() & n.keys() if a[k]["instituicao_id"] != n[k]["instituicao_id"]),
            "semestre": sorted(k for k in a.keys() & n.keys() if a[k]["semestre"] != n[k]["semestre"])}


def resumo(ativos: list[dict], ref: Referencia, snap: str, fontes: dict) -> tuple[dict, int]:
    def loc(l):
        i = ref.instituicoes.get(l["instituicao_id"])
        return (i["cidade_id"], i) if i else (None, None)
    grupos = defaultdict(list)
    for l in ativos:
        grupos[(loc(l)[0], l["instituicao_id"])].append(l)
    cidades: dict = {}
    ocultos = 0
    for (cid, iid), ls in sorted(grupos.items(), key=lambda kv: str(kv[0])):
        inst = ref.instituicoes.get(iid)
        c = ref.cidades.get(cid) if cid else None
        ent = cidades.setdefault(cid or "pendente", {
            "cidade_id": cid or "pendente", "cidade": c["cidade"] if c else None, "pais": c["pais"] if c else None,
            "iso2": c["iso2"] if c else None, "regiao_id": c["regiao_id"] if c else None,
            "regiao_ativa": ref.regiao_ativa(cid), "lat": float(c["lat"]) if c else None, "lon": float(c["lon"]) if c else None,
            "campus_pendente": False, "total": 0, "instituicoes": []})
        oculto = len(ls) < K_MIN
        ocultos += oculto
        ent["total"] += len(ls)
        ent["campus_pendente"] |= bool(inst) and inst["campus_status"] == "pendente"
        cps = defaultdict(Counter)
        for l in ls:
            cps[l["semestre"]][l["curso"]] += 1
        ent["instituicoes"].append({
            "instituicao_id": iid, "nome": inst["nome"] if inst else iid, "campus_status": inst["campus_status"] if inst else "pendente",
            "total": len(ls), "por_semestre": dict(sorted(Counter(l["semestre"] for l in ls).items())),
            "cursos": None if oculto else dict(sorted(Counter(l["curso"] for l in ls).items())),
            "cursos_por_semestre": None if oculto else {k: dict(sorted(v.items())) for k, v in sorted(cps.items())}})
    por_pais = Counter()
    for c in cidades.values():
        por_pais[c["pais"] or "pendente"] += c["total"]
    return {"snapshot": snap, "edital": fontes["edital"], "rotulo": fontes["rotulo"], "total": len(ativos),
            "por_semestre": dict(sorted(Counter(l["semestre"] for l in ativos).items())),
            "por_pais": dict(sorted(por_pais.items())),
            "por_curso": dict(sorted(Counter(l["curso"] for l in ativos).items())),
            "cidades": list(cidades.values()), "k_min": K_MIN}, ocultos


def nomes_por_grupo(ativos: list[dict]) -> dict:
    """{instituicao_id: {semestre: [primeiro nome, ...]}} em ordem alfabética (não revela a nota).
    Sem inscrição. Dado pessoal: o arquivo é gitignored e o front o oculta no modo apresentação."""
    out: dict = defaultdict(lambda: defaultdict(list))
    for l in ativos:
        out[l["instituicao_id"]][l["semestre"]].append(l["primeiro_nome"])
    return {i: {s: sorted(ns, key=str.casefold) for s, ns in sorted(sem.items())} for i, sem in sorted(out.items())}


def pendencias(ativos, linhas, resol, rej, ref: Referencia, ocultos: int, snap: str) -> tuple[str, str]:
    cont = Counter(l["instituicao_id"] for l in ativos)
    md = [f"# Pendências do snapshot {snap}\n", "Gerado por script. Sem nomes nem inscrições (isso fica em `data/private/`).\n",
          f"- Alunos ativos: **{len(ativos)}** | substituídos: {sum(l['status']=='substituido' for l in linhas)} | "
          f"sem vaga: {sum(l['status']=='sem_vaga' for l in linhas)}",
          f"- Grupos (cidade + instituição) com menos de {K_MIN} alunos, sem curso no público: {ocultos}\n"]
    desc = {g: r for g, r in resol.items() if r.metodo == "desconhecida"}
    md.append(f"## Instituições desconhecidas ({len(desc)})\nAdicione a grafia em `data/reference/aliases.csv` ou crie a instituição.\n")
    md += [f"- `{g}`" for g in desc]
    rec = {g: r for g, r in resol.items() if r.metodo in ("prefixo", "subsequencia")}
    md.append(f"\n## A conferir no PDF: texto quebrado/embaralhado, recuperado por heurística ({len(rec)})\n")
    md += [f"- `{g}` → {ref.instituicoes[r.instituicao_id]['nome']} ({r.metodo})" for g, r in rec.items()]
    for st, tit in (("pendente", "Campus pendente (nó provisório na cidade principal)"), ("padrao", "Campus padrão assumido (existe outro campus)")):
        md.append(f"\n## {tit}\n")
        for iid, i in ref.instituicoes.items():
            if i["campus_status"] == st and cont.get(iid):
                md.append(f"- **{i['nome']}** ({ref.cidades[i['cidade_id']]['cidade']}, {cont[iid]} alunos): {i['como_resolver']}")
    md.append("\n## Aliases com fusão assumida\n")
    md += [f"- {a} → {ref.instituicoes[iid]['nome']}: {o}" for iid, (a, o) in ref.aliases_obs.items() if o]
    md.append("\n## Cidade e país inferidos (revisar)\nTodas as cidades e países vêm da tabela de instituições, inferidos.\n")
    md.append("| Instituição | Cidade | País | Status | Alunos |\n|---|---|---|---|---|")
    md += [f"| {ref.instituicoes[i]['nome']} | {ref.cidades[ref.instituicoes[i]['cidade_id']]['cidade']} | "
           f"{ref.cidades[ref.instituicoes[i]['cidade_id']]['pais']} | {ref.instituicoes[i]['status']} | {n} |" for i, n in sorted(cont.items()) if i in ref.instituicoes]
    md.append(f"\n## Coordenadas das cidades\nLatitude/longitude de {len(ref.cidades)} cidades preenchidas por conhecimento do assistente "
              "(`coord_origem=inferido` em `data/reference/cidades.csv`): conferir, principalmente cidades pequenas.")
    bad = [l for l in linhas if not RE_SEMESTRE.match(l["semestre"])]
    md.append(f"\n## Extração\n- Linhas rejeitadas pelo extrator: {len(rej)}\n" + "".join(f"  - {r}\n" for r in rej)
              + f"- Semestres fora do formato: {len(bad)}")
    # privado: nomes e inscrições
    pv = [f"# Pendências por aluno ({snap}) — PRIVADO\n"]
    ativo = {l["inscricao"]: l for l in ativos}
    for l in linhas:
        if l["status"] == "substituido":
            n = ativo.get(l["inscricao"]) or {}
            pv.append(f"- substituído: {l['inscricao']} {l['primeiro_nome']} ({l['curso']}): "
                      f"{l['instituicao_raw']} [{l['semestre']}] → {n.get('instituicao_raw','?')} [{n.get('semestre','?')}]")
    pv += [f"- sem vaga: {l['inscricao']} {l['primeiro_nome']} ({l['curso']})" for l in linhas if l["status"] == "sem_vaga"]
    pv += [f"- proficiência pendente: {l['inscricao']} {l['primeiro_nome']}" for l in linhas
           if resol.get(l["instituicao_raw"]) and "proficiencia_pendente" in resol[l["instituicao_raw"]].flags]
    return "\n".join(md) + "\n", "\n".join(pv) + "\n"


def publicar(linhas: list[dict], ref: Referencia, rej: list[str], hashes: dict, fontes: dict, snap: str,
             base: Path, rotulo: str | None = None) -> dict:
    """Escreve as saídas a partir das linhas (sem ler PDFs)."""
    fontes = dict(fontes, rotulo=rotulo or fontes["rotulo"])
    priv, pub = base / "private", base / "public"
    priv.mkdir(parents=True, exist_ok=True)
    pub.mkdir(parents=True, exist_ok=True)
    resol = {l["instituicao_raw"]: ref.resolver(l["instituicao_raw"]) for l in linhas}
    atual = priv / "alunos.csv"
    antigas = _le_csv(atual)
    if antigas and antigas[0]["snapshot"] != snap:  # rodada nova: guarda a anterior e gera diferenças
        (priv / "snapshots").mkdir(exist_ok=True)
        shutil.copy(atual, priv / "snapshots" / f"alunos_{antigas[0]['snapshot']}.csv")
    else:
        antigas = []
    with open(atual, "w", encoding="utf8", newline="") as f:
        w = csv.DictWriter(f, COLUNAS, extrasaction="ignore")
        w.writeheader()
        w.writerows(linhas)
    ativos = [l for l in linhas if l["status"] == "ativo"]
    res, ocultos = resumo(ativos, ref, snap, fontes)
    (pub / "resumo.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf8")
    (pub / "nomes.json").write_text(json.dumps(nomes_por_grupo(ativos), ensure_ascii=False, indent=1), encoding="utf8")
    md_pub, md_priv = pendencias(ativos, linhas, resol, rej, ref, ocultos, snap)
    (pub / "pendencias.md").write_text(md_pub, encoding="utf8")
    (priv / "pendencias_alunos.md").write_text(md_priv, encoding="utf8")
    (priv / "manifest.json").write_text(json.dumps({"snapshot": snap, "edital": fontes["edital"], "rotulo": fontes["rotulo"],
                                                    "pdfs_sha256": hashes, "rejeitadas": rej}, indent=1), encoding="utf8")
    dif = diferencas(antigas, linhas) if antigas else None
    if dif:
        (priv / "diff.md").write_text("# Diferenças vs rodada anterior\n" + "".join(
            f"\n## {k} ({len(v)})\n" + "".join(f"- {i}\n" for i in v) for k, v in dif.items()), encoding="utf8")
    return {"linhas": len(linhas), "ativos": len(ativos), "substituidos": sum(l["status"] == "substituido" for l in linhas),
            "sem_vaga": sum(l["status"] == "sem_vaga" for l in linhas), "resolucao": dict(Counter(r.metodo for r in resol.values())),
            "rejeitadas": len(rej), "grupos_ocultos": ocultos, "diff": {k: len(v) for k, v in dif.items()} if dif else None}


def _fontes(caminho: Path | None) -> dict:
    return tomllib.loads((caminho or Path(__file__).parent.parent / "fontes.toml").read_text(encoding="utf8"))


def rodar(pdfs: Path, data: Path, hoje: date | None = None, base: Path | None = None, rotulo: str | None = None) -> dict:
    """Nova rodada de snapshot: lê os PDFs. `base` = onde gravar (padrão `data`)."""
    snap = (hoje or date.today()).strftime("%Y_%m_%d")
    fontes, ref = _fontes(None), Referencia(data / "reference")
    linhas, hashes, rej = extrair(pdfs, fontes, ref, snap)
    out = publicar(linhas, ref, rej, hashes, fontes, snap, base or data, rotulo)
    from . import flat
    flat.gerar(ref, (base or data) / "public" / "instituicoes_flat.csv")
    return out


def reconstruir(data: Path, base: Path | None = None, rotulo: str | None = None) -> dict:
    """Regera as saídas a partir de alunos.csv, reaplicando a referência atual. Não lê PDFs."""
    base = base or data
    linhas = _le_csv(base / "private" / "alunos.csv")
    ref, fontes = Referencia(data / "reference"), _fontes(None)
    for l in linhas:
        l["instituicao_id"] = ref.resolver(l["instituicao_raw"]).instituicao_id
    man = json.loads((base / "private" / "manifest.json").read_text(encoding="utf8"))
    out = publicar(linhas, ref, man.get("rejeitadas", []), man.get("pdfs_sha256", {}), fontes, linhas[0]["snapshot"], base, rotulo or man.get("rotulo"))
    from . import flat
    flat.gerar(ref, (base or data) / "public" / "instituicoes_flat.csv")
    return out
