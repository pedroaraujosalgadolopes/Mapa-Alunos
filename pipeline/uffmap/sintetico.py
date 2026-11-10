"""Dataset sintético: PDFs falsos com o mesmo layout (e os mesmos defeitos) dos do edital.

Nomes e inscrições são falsos (inscrições 99xxx). Serve para testes e demos públicas.
Requer reportlab (requirements-dev).
"""
from __future__ import annotations

import random
import tempfile
import tomllib
from datetime import date
from pathlib import Path

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

from .normalize import Referencia

NOMES = ["Alfa", "Bravo", "Charlie", "Delta", "Eco", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima",
         "Mike", "Nova", "Oscar", "Papa", "Quebec", "Romeu", "Sierra", "Tango"]  # repetidos de propósito
CURSOS = ["Direito", "Arquitetura e Urbanismo", "Ciência da Computação", "Relações Internacionais", "Psicologia",
          "Cinema e Audiovisual", "Engenharia Civil", "Medicina", "Jornalismo", "Direito (Volta Redonda)",
          "Psicologia(Rio das Ostras)", "Eng de Recursos Hídricos e Meio Ambiente"]
FONTES_SIM = "Edital 082026 - {}.pdf"
Y0, PASSO, POR_PAGINA = 540, 24, 20


def _pagina(c: canvas.Canvas, titulo: str, linhas: list[dict], ordem: str):
    """ordem 'normal': insc nome curso nota inst sem | 'exc': insc sem nome curso nota inst."""
    c.setFont("Helvetica", 9)
    c.drawString(30, 570, titulo)
    xs = ({"insc": 30, "nome": 80, "curso": 150, "nota": 345, "inst": 385, "sem": 720} if ordem == "normal"
          else {"insc": 30, "sem": 75, "nome": 130, "curso": 200, "nota": 360, "inst": 400})
    for i, l in enumerate(linhas):
        y = Y0 - i * PASSO
        c.drawString(xs["insc"], y, l["insc"])
        c.drawString(xs["nome"], y, l["nome"])
        c.drawString(xs["curso"], y, l["curso"])
        c.drawString(xs["nota"], y, l["nota"])
        c.drawString(xs["sem"], y, l["sem"])
        partes = l["inst"].split("\n")  # instituição quebrada em linhas (centrada na altura da linha)
        for k, parte in enumerate(partes):
            c.drawString(xs["inst"], y + 5 - 10 * k if len(partes) > 1 else y, parte)


def _pdf(destino: Path, titulo: str, linhas: list[dict], ordem="normal"):
    c = canvas.Canvas(str(destino), pagesize=landscape(A4))
    for i in range(0, max(len(linhas), 1), POR_PAGINA):
        _pagina(c, titulo, linhas[i:i + POR_PAGINA], ordem)
        c.showPage()
    c.save()


def gerar_pdfs(dest: Path, seed: int = 7, n: int = 90) -> dict:
    """Escreve os 6 PDFs em `dest` e devolve a verdade esperada para os testes."""
    rnd = random.Random(seed)
    ref = Referencia(Path(__file__).parent.parent.parent / "data" / "reference")
    ok = [i for i in ref.instituicoes.values() if i["nome"].encode("cp1252", "ignore").decode("cp1252") == i["nome"]
          and i["instituicao_id"] != "sem-destino"]
    escolhidas = rnd.sample(ok, 35)
    pesos = [rnd.randint(1, 6) for _ in escolhidas]
    sem = lambda: rnd.choice(["2027.2", "2028.1"])
    alunos = []
    for k in range(n):
        i = rnd.choices(escolhidas, pesos)[0]
        alunos.append({"insc": f"99{k + 1:03d}", "nome": NOMES[k % len(NOMES)].upper(), "curso": rnd.choice(CURSOS),
                       "nota": f"{rnd.uniform(6, 11.5):.2f}".replace(".", ","), "inst": i["nome"], "sem": sem()})
    # casos de borda
    alunos[0].update(curso="Engenharia de Agronegócios(Volta Redonda)", inst="Instituto Politécnico de Bragança")
    alunos[1].update(inst="Universidade de Lisboa - Instituto Superior de\nEconomia e Gestão")
    alunos[2].update(inst="Universidade Ficticia de Teste")  # desconhecida: não pode quebrar o build
    alunos[3].update(inst="Universidad Autónoma de Barcelona - pendente comprovante de proficiência")
    sem_vaga = {"insc": "99901", "nome": "ZULU*", "curso": "Letras", "nota": "9,86", "inst": "Sem vaga*", "sem": "2027.2"}
    trocado = dict(alunos[10])  # mesmo aluno muda de destino na 2ª rodada
    novo_inst = next(i["nome"] for i in escolhidas if i["nome"] != trocado["inst"])
    exc = [dict(sem_vaga, nome="Zulu", inst="Instituto Politécnico de Tomar"),
           dict(trocado, nome=trocado["nome"].title(), inst=novo_inst, sem="2028.1" if trocado["sem"] == "2027.2" else "2027.2")]
    dest.mkdir(parents=True, exist_ok=True)
    principais = alunos[:n - 15]
    _pdf(dest / FONTES_SIM.format("Alocação Geral (sem os bolsistas)"), "Edital 08/2026 - Alocação - Geral", principais)
    for g, (a, b) in enumerate([(n - 15, n - 10), (n - 10, n - 8), (n - 8, n)], start=1):
        extra = [sem_vaga] if g == 3 else []
        _pdf(dest / FONTES_SIM.format(f"Alocação - Socioeconômico - Grupo {g}"), f"Edital 08/2026 - Alocação - Grupo {g}", alunos[a:b] + extra)
    _pdf(dest / FONTES_SIM.format("Alocação dos candidatos excedentes"), "Edital 08/2026 - Alocação dos candidatos excedentes", exc, "exc")
    _pdf(dest / FONTES_SIM.format("Lista de candidatos excedentes"), "Edital 08/2026 - Lista de candidatos excedentes", [])
    return {"ativos": n, "substituidos": 2, "inscricao_trocada": trocado["insc"], "novo_inst": novo_inst,
            "desconhecida": "Universidade Ficticia de Teste"}


def gerar_snapshot(data: Path, seed: int = 7) -> dict:
    """Gera PDFs falsos num diretório temporário e roda o pipeline real em data/synthetic."""
    from . import snapshot
    with tempfile.TemporaryDirectory() as tmp:
        gerar_pdfs(Path(tmp), seed)
        return snapshot.rodar(Path(tmp), data, hoje=date(2026, 1, 15), base=data / "synthetic", rotulo="sintetico")
