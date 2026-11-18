# Rede de Apoio do Intercâmbio UFF

Mapa para que quem vai de intercâmbio pelo **Edital 08/2026 de mobilidade internacional da UFF** (semestres 2027.2 e
2028.1) veja onde cada colega vai ficar e **ninguém fique sozinho**: moradia, burocracia, viagens e troca cultural.
A ideia central: um aluno em Santander poder visitar uma colega em Barcelona, e quem vai a Paris encontrar quem está
perto.

> **Status: protótipo.** Pronto: extração dos PDFs do edital, snapshots reexecutáveis, mapa com filtros de semestre e
> país, painel por cidade, modo apresentação, "perto de mim" (raio em horas) e grafo arrastável com grupos por corte de
> horas. **Tempos de viagem:** o módulo (Transitous) está pronto, mas só o dataset **sintético** tem tempos, e são
> **simulados** (marcados como tal). Os tempos reais dependem da primeira consulta ao Transitous. **Ainda não existe:**
> fusão automática de grupos pequenos (Fase 2), cadastro/login/chat (Fase 4). Os dados são **preliminares**.

## Rodar só com dados sintéticos (sem nenhum dado real)

Você não precisa de PDF nem de dado pessoal. Requisitos: Python 3.11+ e Node 20+.

```bash
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements-dev.txt
PYTHONPATH=pipeline .venv/bin/pytest pipeline/tests -q            # testes do pipeline
PYTHONPATH=pipeline .venv/bin/python -m uffmap sintetico          # regera data/synthetic (opcional)
PYTHONPATH=pipeline .venv/bin/python -m uffmap tempos --dry-run --contato seu@contato  # plano da consulta real (sem rede)
PYTHONPATH=pipeline .venv/bin/python -m uffmap voos; PYTHONPATH=pipeline .venv/bin/python -m uffmap onibus   # estimativas (sem rede)
sh scripts/instalar_hooks.sh                                      # ativa o bloqueio de dado pessoal no commit

cd web && npm install && npm test                                   # testes da lógica de tempos/grupos
DATA_SOURCE=synthetic MOSTRAR_NOMES=1 npm run dev                 # http://localhost:3000
```

Sem `data/public/resumo.json` (arquivo real, que nunca vai ao repositório) o site já usa o sintético. O sintético tem
nomes e inscrições **falsos** (inscrições `99xxx`). Para ver o modo apresentação: `http://localhost:3000/?apresentacao=1`.

## Como funciona

```
PDFs do edital (fora do repo) ──► pipeline/uffmap ──► data/private/alunos.csv   (nome + inscrição; NUNCA versionado)
                                          │
                                          ├──► data/public/resumo.json   agregados por cidade/instituição (local)
                                          ├──► data/public/nomes.json    primeiro nome/curso por grupo (local, opt-in)
                                          └──► data/public/pendencias.md o que ficou ambíguo (local)
data/reference/*.csv (cidades, instituições, aliases)  ◄── contribuição da comunidade, via PR
web/  (Next.js + MapLibre + OpenStreetMap) lê só data/public e data/reference
```

- **Cidade e país não vêm do PDF**: são inferidos pelo nome da instituição (tabela `instituicoes.csv`), sempre com
  `status` (`confirmado`/`inferido`/`pendente`). Campus ambíguo vira um nó provisório marcado como pendente.
- **Snapshots reexecutáveis**: cada rodada registra a data e o hash dos PDFs e gera um relatório de diferenças (entrou,
  saiu, mudou de destino/semestre), casando sempre por número de inscrição. `uffmap reconstruir` regera as saídas a partir
  do CSV privado, sem reler os PDFs.
- **Nada fixo no código**: cidades, instituições e contagens vêm dos dados. Instituição desconhecida vai para
  `pendencias.md` e o site continua funcionando.
- **Visual** em um único arquivo: `web/design/tokens.json`. **Textos** em `web/i18n/` (pt-BR agora; en e es depois).
- **Regiões**: `data/reference/regioes.csv` liga cada cidade a uma região; só a Europa está ativa no começo.

## Privacidade (regras do projeto)

- O número de inscrição **nunca** aparece no site nem no repositório. Dado pessoal (nome, inscrição, PDFs, CSV de
  alunos) **nunca** entra no repositório: `data/raw/`, `data/private/`, `data/snapshots/` e os derivados de dado real
  estão no `.gitignore`.
- `scripts/check_privacy.py` roda no pré-commit e no CI e **falha** se aparecer PDF, planilha, `.env`, CSV fora de
  `data/reference`/`data/synthetic` ou padrão de número de inscrição.
- O modo apresentação (`?apresentacao=1`) mostra só dados agregados, sem nomes.
- Nomes visíveis no painel dependem de `MOSTRAR_NOMES=1` (decisão local). Com o cadastro (Fase 4) o padrão volta a ser
  o **consentimento explícito e revogável**. Detalhes em [docs/privacidade.md](docs/privacidade.md).

### Segredo de pseudônimo (`PSEUDONYM_SECRET`): faça backup

Quando o front passar a consumir ids públicos (`pub_id`), eles serão calculados com HMAC usando o segredo
`PSEUDONYM_SECRET`, guardado só em `.env` (fora do git; veja `.env.example`). Sem o segredo, o pipeline **recusa** gerar
dado público. **Guarde um backup do segredo** (gerenciador de senhas): perdê-lo invalida todos os ids antigos e quebra o
diff entre rodadas. Se ele vazar, troque-o (e os ids mudam). Ainda não é usado: hoje o front só recebe agregados.

## Contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md). O jeito mais fácil de ajudar, sem programar: corrigir ou completar
`data/reference/instituicoes.csv` e `aliases.csv` (cidade, campus, status). Também precisamos de design, tradução (en/es),
testes e comunicação.

## Licenças

- **Código:** [MIT](LICENSE).
- **Dados de referência** (`data/reference/`, `data/public/instituicoes_flat.csv`, `data/synthetic/`): CC0 1.0,
  ver [data/reference/LICENSE.md](data/reference/LICENSE.md).
- **Dado pessoal nunca entra no repositório**, qualquer que seja a licença.
- **Tempos de viagem reais** (`data/reference/tempos/`): derivados do Transitous e das fontes de transporte dele, cada uma
  com sua licença (não são CC0). Veja [transitous.org/sources](https://transitous.org/sources/).
- Mapa: © contribuidores do OpenStreetMap.

Projeto de estudantes, sem vínculo oficial com a UFF. Os dados vêm de PDFs públicos do edital da UFF (https://editais.uff.br/11710). O projeto é livre e de código aberto: pode ser usado, modificado e redistribuído (MIT para o código, CC0 para os dados de referência), e ajuda é bem-vinda (veja CONTRIBUTING.md).
