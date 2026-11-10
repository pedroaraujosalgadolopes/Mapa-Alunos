import argparse
import json
from pathlib import Path

from .snapshot import rodar

ap = argparse.ArgumentParser(prog="uffmap", description="Gera um snapshot a partir dos PDFs do edital.")
ap.add_argument("--pdfs", type=Path, required=True, help="pasta com os PDFs (fora do repositório)")
ap.add_argument("--data", type=Path, default=Path("data"))
a = ap.parse_args()
print(json.dumps(rodar(a.pdfs, a.data), ensure_ascii=False, indent=1))
