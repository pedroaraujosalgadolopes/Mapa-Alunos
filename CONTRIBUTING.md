# Como contribuir

Obrigado por ajudar! Este projeto lida com dados de estudantes, então a **privacidade vem antes de tudo**.

## Regras de privacidade (valem para todo PR, issue e print)

1. **Nunca** inclua: números de inscrição, nomes de alunos, PDFs do edital, CSV de alunos, e-mails, capturas de tela com
   nomes reais. Se achar que algo assim já foi enviado, avise a pessoa mantenedora **por canal privado** (não em issue
   pública) e não reabra o assunto em comentários.
2. Dados reais ficam só no seu computador, em `data/raw/`, `data/private/` e `data/snapshots/` (já ignorados pelo git).
3. Para testar e para prints/demos use **só o dataset sintético** (`data/synthetic/`, nomes falsos, inscrições `99xxx`).
4. Ative a guarda local: `sh scripts/instalar_hooks.sh`. O CI roda a mesma verificação (`scripts/check_privacy.py`) e
   bloqueia o PR se falhar. Se uma linha legítima for barrada (um número de 5 dígitos que não é inscrição), acrescente o
   comentário `privacy-ok` na própria linha.

## Fluxo

1. Abra (ou escolha) uma issue. Para dados de instituição, use o modelo "Corrigir/adicionar instituição".
2. Faça um fork, crie uma branch (`dados/...`, `design/...`, `i18n/...`, `fix/...`) e abra um PR pequeno e focado.
3. Rode antes: `PYTHONPATH=pipeline .venv/bin/pytest pipeline/tests -q` e, se mexeu no front, `cd web && npx tsc --noEmit`.
4. Mensagens de commit curtas e claras, em português ("Corrige cidade da ESS do IPP").
5. Uma pessoa mantenedora revisa. Mudanças em dados exigem a fonte (site oficial da universidade).

## Papéis (escolha o seu)

| Papel | O que fazer | Onde |
|---|---|---|
| **Curadoria de dados** | Conferir cidade, campus, país e grafias das instituições; resolver pendências | `data/reference/` |
| **Design** | Propor cores, tipografia e espaçamentos sem mexer em lógica | `web/design/tokens.json` |
| **Tradução** | Traduzir a interface para inglês e espanhol | `web/i18n/` |
| **Desenvolvimento** | Pipeline (Python), mapa e grafo (Next.js/TypeScript), testes | `pipeline/`, `web/` |
| **Testes/QA** | Testar no celular e em navegadores, reportar bugs sem dado real | issues |
| **Comunicação** | Textos, avisos de privacidade, divulgação entre os alunos | `docs/` |

## Editando os dados de referência (sem programar)

Tudo em `data/reference/`, em CSV (abre em planilha; salve como CSV UTF-8, sem aspas extras):

- `cidades.csv`: `cidade_id`, `cidade`, `pais`, `iso2`, `regiao_id`, `lat`, `lon`, `coord_origem`.
- `instituicoes.csv`: `instituicao_id`, `nome`, `cidade_id`, `status`, `campus_status`, `campus`, `como_resolver`.
  - `status`: `confirmado` (conferido em fonte oficial), `inferido` (dedução razoável), `pendente` (precisa de alguém).
  - `campus_status`: `unico`, `padrao` (cidade principal assumida; existe outro campus) ou `pendente` (nó provisório).
- `aliases.csv`: `alias` (grafia como aparece nos PDFs) → `instituicao_id`. Acentos e maiúsculas são ignorados.
- Para revisar tudo numa planilha só, use `data/public/instituicoes_flat.csv` (gerado por `python -m uffmap flat`);
  **edite sempre os arquivos normalizados**, não o `flat`.

Ao marcar algo como `confirmado`, cite a fonte no PR.

## Roteiro (resumo)

Fase 1: tempos de viagem entre cidades (com cache e fonte) · Fase 2: clusters e regra "ninguém sozinho" ·
Fase 3: grafo móvel, "perto de mim" e página de viagens · Fase 4: cadastro com consentimento, login e conversa.
Ideias começam em issue; decisões de privacidade sempre passam por revisão.
