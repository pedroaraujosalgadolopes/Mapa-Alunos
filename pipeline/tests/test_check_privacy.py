import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))
from check_privacy import analisar  # noqa: E402


def test_pdf_e_dados_reais_bloqueados():
    assert analisar("x/a.pdf", b"")
    assert analisar("data/private/alunos.csv", b"")
    assert analisar("data/snapshots/2026_11_10/a.json", b"{}")
    assert analisar("data/public/resumo.json", b"{}")
    assert analisar(".env", b"PSEUDONYM_SECRET=abc")


def test_csv_so_em_pastas_permitidas():
    assert not analisar("data/reference/cidades.csv", b"a,b")
    assert not analisar("data/synthetic/private/alunos.csv", b"a,b")
    assert analisar("docs/alunos.csv", b"a,b")


def test_numero_de_inscricao():
    assert analisar("a.md", b"aluno 12345 em Roma")  # privacy-ok
    assert not analisar("a.md", b"aluno 99123 (falso)")
    assert not analisar("a.md", b"versao 1.12345 e #123456 e 123456 e lat 41.15000")
    assert not analisar("a.md", b"12345 privacy-ok")
    assert not analisar(".env.example", b"PSEUDONYM_SECRET=")
