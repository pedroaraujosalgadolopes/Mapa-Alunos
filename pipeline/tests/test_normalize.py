from pathlib import Path

import pytest

from uffmap.normalize import Referencia, fold, normaliza_curso, normaliza_nome

REF = Referencia(Path(__file__).parent.parent.parent / "data" / "reference")


def test_fold_ignora_acento_caixa_pontuacao():
    assert fold("Universidad de Almería ") == fold("UNIVERSIDAD DE ALMERIA")


@pytest.mark.parametrize("raw,curso,campus", [
    ("Direito ( Macaé)", "Direito", "Macaé"),
    ("Pedagogia(Pádua)", "Pedagogia", "Pádua"),
    ("Eng de Recursos Hídricos e Meio Ambiente", "Engenharia de Recursos Hídricos e Meio Ambiente", None),
    ("Medicina", "Medicina", None)])
def test_curso_separa_campus_de_origem(raw, curso, campus):
    assert normaliza_curso(raw) == (curso, campus)


def test_nome():
    assert normaliza_nome("JONATHAN*") == "Jonathan"


def test_resolver_exato_e_variantes():
    base = REF.resolver("Sapienza Università di Roma").instituicao_id
    assert REF.resolver("Sapienza Universitá di Roma").instituicao_id == base
    assert REF.resolver("UNIVERSITE TOULOUSE JEAN JAURES").metodo == "exato"


def test_resolver_texto_truncado_e_embaralhado():
    assert REF.resolver("Universidade de Lisboa - Instituto Superior de").metodo == "prefixo"
    r = REF.resolver("EBcaounhoamusia-U en Giveersstãitaot Weimar")
    assert (r.metodo, r.instituicao_id) == ("subsequencia", "bauhaus")


def test_status_colado_vira_flag():
    r = REF.resolver("Universidad Autónoma de Barcelona - pendente comprovante de proficiência")
    assert r.instituicao_id == "uab" and "proficiencia_pendente" in r.flags


def test_desconhecida_nao_quebra():
    r = REF.resolver("Universidade Inventada do Nada")
    assert r.metodo == "desconhecida" and r.instituicao_id.startswith("pendente-")


def test_sem_vaga():
    assert REF.resolver("Sem vaga*").metodo == "sem_destino"


def test_referencia_consistente():
    assert all(i["cidade_id"] in REF.cidades for i in REF.instituicoes.values())
    assert all(c["regiao_id"] in REF.regioes for c in REF.cidades.values())
    assert all(i["status"] in {"confirmado", "inferido", "pendente"} for i in REF.instituicoes.values())
