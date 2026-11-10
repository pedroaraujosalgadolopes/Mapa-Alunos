# Pendências do snapshot 2026_01_15

Gerado por script. Sem nomes nem inscrições (isso fica em `data/private/`).

- Alunos ativos: **91** | substituídos: 2 | sem vaga: 0
- Grupos (cidade + instituição) com menos de 3 alunos, sem curso no público: 18

## Instituições desconhecidas (1)
Adicione a grafia em `data/reference/aliases.csv` ou crie a instituição.

- `Universidade Ficticia de Teste`

## A conferir no PDF: texto quebrado/embaralhado, recuperado por heurística (0)


## Campus pendente (nó provisório na cidade principal)

- **Universidade dos Açores** (Ponta Delgada, 1 alunos): Três ilhas (Ponta Delgada/Angra do Heroísmo/Horta). Resolver pelo curso do aluno.
- **Universidad de Guanajuato** (Guanajuato, 2 alunos): Campi em Guanajuato/León/Irapuato/Celaya/Salamanca. Nó provisório em Guanajuato. Resolver pelo curso.

## Campus padrão assumido (existe outro campus)

- **Universidade do Minho** (Braga, 4 alunos): Padrão Braga (Gualtar); existe campus em Guimarães. Conferir pelo curso.
- **Instituto Politécnico de Tomar** (Tomar, 3 alunos): Padrão Tomar; existe campus em Abrantes. Conferir pelo curso.
- **Instituto Politécnico de Bragança** (Bragança, 1 alunos): Padrão Bragança; existe escola em Mirandela. O edital escreve "Universidade Politécnica de Bragança"; assumi o IPB.
- **Instituto Politécnico do Cávado e do Ave** (Barcelos, 2 alunos): Padrão Barcelos; há escolas em Braga/Guimarães/V.N. Famalicão. O edital também escreve "Universidade Politécnica do Cávado e do Ave"; assumi a mesma instituição.
- **Universidad de Cundinamarca** (Fusagasugá, 1 alunos): Padrão Fusagasugá (sede); há outras sedes. Conferir pelo curso.

## Aliases com fusão assumida

- Universidade do Porto - (Planejamento e Projeto Urbano) → Universidade do Porto: Grafia com nome do programa; tratada como Universidade do Porto.
- Instituto Politécnico do Porto → Instituto Politécnico do Porto (escola não informada): Escola não informada.

## Cidade e país inferidos (revisar)
Todas as cidades e países vêm da tabela de instituições, inferidos.

| Instituição | Cidade | País | Status | Alunos |
|---|---|---|---|---|
| Instituto Politécnico de Bragança | Bragança | Portugal | inferido | 1 |
| Instituto Politécnico de Beja | Beja | Portugal | inferido | 2 |
| Instituto Politécnico de Coimbra | Coimbra | Portugal | inferido | 2 |
| Instituto Politécnico do Cávado e do Ave | Barcelos | Portugal | inferido | 2 |
| Instituto Politécnico de Castelo Branco | Castelo Branco | Portugal | inferido | 3 |
| IPP - Escola Superior de Media Artes e Design | Vila do Conde | Portugal | inferido | 1 |
| IPP - Instituto Superior de Engenharia do Porto | Porto | Portugal | inferido | 4 |
| Instituto Politécnico de Tomar | Tomar | Portugal | inferido | 3 |
| Masaryk University | Brno | Tchéquia | inferido | 3 |
| Université Sorbonne Nouvelle - Paris 3 | Paris | França | inferido | 7 |
| Universidad Autónoma de Barcelona | Cerdanyola del Vallès | Espanha | inferido | 1 |
| Universidade dos Açores | Ponta Delgada | Portugal | pendente | 1 |
| Alexandru Ioan Cuza University | Iași | Romênia | inferido | 2 |
| Universidad de Almería | Almería | Espanha | inferido | 7 |
| Universidade de Coimbra | Coimbra | Portugal | inferido | 1 |
| Universidade Católica de Angola | Luanda | Angola | inferido | 1 |
| Universidad de Congreso | Mendoza | Argentina | inferido | 1 |
| Universidad de Cundinamarca | Fusagasugá | Colômbia | inferido | 1 |
| Université de Montréal | Montreal | Canadá | inferido | 1 |
| Universitat de Girona | Girona | Espanha | inferido | 2 |
| Universidad de Guanajuato | Guanajuato | México | pendente | 2 |
| Universidade de Lisboa - Faculdade de Ciências | Lisboa | Portugal | inferido | 3 |
| Universidade de Lisboa - Instituto Superior de Economia e Gestão | Lisboa | Portugal | inferido | 5 |
| Universität Ulm | Ulm | Alemanha | inferido | 7 |
| Universidade do Minho | Braga | Portugal | inferido | 4 |
| Universidad de Cantabria | Santander | Espanha | inferido | 1 |
| Università degli Studi di Firenze | Florença | Itália | inferido | 2 |
| Universität Wien | Viena | Áustria | inferido | 7 |
| Universidad Nacional de Rosario | Rosário | Argentina | inferido | 5 |
| University of Ottawa | Ottawa | Canadá | inferido | 3 |
| Université Toulouse - Jean Jaurès | Toulouse | França | inferido | 5 |

## Coordenadas das cidades
Latitude/longitude de 82 cidades preenchidas por conhecimento do assistente (`coord_origem=inferido` em `data/reference/cidades.csv`): conferir, principalmente cidades pequenas.

## Extração
- Linhas rejeitadas pelo extrator: 0
- Semestres fora do formato: 0
