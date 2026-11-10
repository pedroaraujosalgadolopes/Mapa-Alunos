import pdfplumber

from uffmap.extract import parse_words
from uffmap.sintetico import gerar_pdfs


def W(text, x0, top):
    return {"text": text, "x0": x0, "x1": x0 + 5 * len(text), "top": top}


def linha(top, insc, nome, curso, nota, inst, sem, x=(30, 80, 150, 345, 385, 720)):
    ws = [W(insc, x[0], top), W(nome, x[1], top), W(nota, x[3], top), W(sem, x[5], top)]
    ws += [W(p, x[2] + 40 * i, top) for i, p in enumerate(curso.split())]
    ws += [W(p, x[4] + 40 * i, top) for i, p in enumerate(inst.split())]
    return ws


def test_nota_colada_e_glifos_trocados():
    words = (linha(100, "99001", "ALFA", "Eng Civil", "9,5", "Univ X", "2027.2")
             + [W("99002", 30, 130), W("BRAVO", 80, 130), W("Agronegócios(Volta", 150, 130), W("Redonda8),08", 260, 130),
                W("Univ", 385, 130), W("Y", 425, 130), W("2028.1", 720, 130)]
             + [W("99003", 30, 160), W("ECO", 80, 160), W("Meio", 150, 160), W("Ambiente6,84", 210, 160), W("Univ", 385, 160),
                W("(cid:10)", 430, 160), W("2028.1", 720, 160)])
    rows = parse_words(words, "t.pdf", 1).rows
    assert [(r.nome, r.curso, r.pontuacao) for r in rows] == [
        ("ALFA", "Eng Civil", "9,5"), ("BRAVO", "Agronegócios(Volta Redonda)", "8,08"), ("ECO", "Meio Ambiente", "6,84")]
    assert rows[2].instituicao == "Univ"  # (cid:10) descartado


def test_instituicao_quebrada_em_duas_linhas_e_nota_antes_de_numero_na_instituicao():
    words = linha(100, "99001", "ALFA", "Direito", "9,9", "Sorbonne Paris 3", "2027.2")
    words += [W("Economia", 385, 105)]  # continuação da instituição (2ª linha, ~5pt abaixo)
    r = parse_words(words, "t.pdf", 1).rows[0]
    assert r.pontuacao == "9,9" and r.instituicao == "Sorbonne Paris 3 Economia"


def test_linha_sem_semestre_vai_para_rejeitadas():
    out = parse_words(linha(100, "99001", "ALFA", "Direito", "9,9", "Univ", "xx"), "t.pdf", 1)
    assert not out.rows and len(out.rejeitadas) == 1 and "99001" not in out.rejeitadas[0]


def test_pdf_sintetico_ida_e_volta(tmp_path):
    from uffmap.extract import extract_pdf
    gerar_pdfs(tmp_path)
    geral = extract_pdf(tmp_path / "Edital 082026 - Alocação Geral (sem os bolsistas).pdf")
    assert len(geral.rows) == 75 and not geral.rejeitadas
    assert any(r.instituicao.endswith("Economia e Gestão") for r in geral.rows)
    exc = extract_pdf(tmp_path / "Edital 082026 - Alocação dos candidatos excedentes.pdf")
    assert len(exc.rows) == 2 and all(r.semestre.startswith("20") for r in exc.rows)
    assert pdfplumber.open(tmp_path / "Edital 082026 - Lista de candidatos excedentes.pdf")
