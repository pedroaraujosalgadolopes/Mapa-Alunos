# Modelo de dados (rumo a um banco e a um grafo)

Hoje: CSVs (`data/reference/` público, `data/private/` local). Isto descreve para onde vai, sem mudar nada ainda.

## Objetos (cada um vira uma tabela ou um nó, e pode ganhar campos depois)

| Objeto | Campos hoje | Pode ganhar |
|---|---|---|
| **Pessoa** | primeiro nome, curso, campus de origem na UFF, semestre | interesses, links, foto, consentimento |
| **Curso** | nome | **Área** (`areas.csv`), tema de TCC |
| **Área** | nome | subáreas, grupos de interesse |
| **Instituição** | nome, cidade, campus_status | site, vagas, avaliações |
| **Cidade** | nome, país, lat/lon | tempos de viagem, guia da cidade |
| **Viagem** | origem, destino, minutos, modo | trecho a trecho, fonte |

## Relações (arestas do grafo)

`Pessoa —estuda_em→ Instituição —fica_em→ Cidade`, `Pessoa —cursa→ Curso —pertence_a→ Área`,
`Cidade —viagem(min, modo)→ Cidade`. Um objeto novo (ex.: Projeto de TCC) é só mais um tipo de nó.

## Banco: o que usar

Com centenas de pessoas e dezenas de cidades, **um banco relacional (Postgres/SQLite) basta**: as perguntas
("quem da área X está a menos de 3 h?") são joins simples. Um banco de grafo só compensa com muito mais dados ou
caminhos de vários saltos. Recomendação: tabelas com ids estáveis e tabela de arestas genérica (`origem`, `tipo`,
`destino`, `props`), o que permite migrar para um grafo depois sem refazer.

## Campus por curso (já funciona)

`data/reference/campus_por_curso.csv` (`instituicao_id,curso,cidade_id,observacao`) troca a cidade de quem faz
aquele curso naquela instituição; a cidade precisa existir em `cidades.csv`. Sem linha, vale a sede.
