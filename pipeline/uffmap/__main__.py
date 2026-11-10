import argparse
import os
import json
from pathlib import Path

from . import snapshot

ap = argparse.ArgumentParser(prog="uffmap")
sub = ap.add_subparsers(dest="cmd", required=True)
r = sub.add_parser("rodar", help="nova rodada de snapshot lendo os PDFs (fora do repositório)")
r.add_argument("--pdfs", type=Path, required=True)
sub.add_parser("reconstruir", help="regera resumo/pendências a partir de data/private/alunos.csv, sem PDFs")
t = sub.add_parser("tempos", help="tempos de viagem (trem/ônibus) via Transitous, com cache em data/reference/tempos")
t.add_argument("--contato", default=os.environ.get("TRANSITOUS_CONTACT", ""), help="e-mail ou site para o User-Agent (exigido pelo Transitous)")
t.add_argument("--max-min", type=int, default=600)
t.add_argument("--raio-parada-m", type=int, default=2000)
t.add_argument("--forcar", action="store_true")
t.add_argument("--so-origem")
t.add_argument("--dry-run", action="store_true")
sub.add_parser("flat", help="gera data/public/instituicoes_flat.csv a partir de data/reference")
s = sub.add_parser("sintetico", help="gera o dataset sintético (PDFs falsos + snapshot) em data/synthetic")
s.add_argument("--seed", type=int, default=7)
ap.add_argument("--data", type=Path, default=Path("data"))
a = ap.parse_args()
if a.cmd == "rodar":
    out = snapshot.rodar(a.pdfs, a.data)
elif a.cmd == "reconstruir":
    out = snapshot.reconstruir(a.data)
elif a.cmd == "tempos":
    from .tempos import Config, rodar as rodar_tempos
    out = rodar_tempos(a.data, Config(a.contato, a.max_min, a.raio_parada_m), forcar=a.forcar, so_origem=a.so_origem, dry_run=a.dry_run)
elif a.cmd == "flat":
    from .flat import gerar
    from .normalize import Referencia
    out = {"linhas": gerar(Referencia(a.data / "reference"), a.data / "public" / "instituicoes_flat.csv")}
else:
    from .sintetico import gerar_snapshot
    out = gerar_snapshot(a.data, a.seed)
print(json.dumps(out, ensure_ascii=False, indent=1))
