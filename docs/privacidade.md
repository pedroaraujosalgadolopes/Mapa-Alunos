# Privacidade

## Fontes e o que é guardado
- Fonte: PDFs públicos do Edital 08/2026 da UFF (nº de inscrição, primeiro nome, curso, destino, semestre).
- **Nunca expostos**: número de inscrição e pontuação (a pontuação nem é gravada).
- **Só local** (fora do repositório): `data/private/alunos.csv`, PDFs, derivados de dado real.
- Do destino guardamos **apenas cidade e campus**, nunca endereço.

## O que cada pessoa vê
| Quem | Vê |
|---|---|
| Visitante | cidade, universidade, contagem por semestre e cursos agregados; em grupos (cidade + instituição) com menos de 3 alunos, só a contagem |
| Modo apresentação (SRI) | só agregados, sem nomes, sem curso por pessoa |
| Uso local com `MOSTRAR_NOMES=1` | primeiro nome, curso e campus de origem por semestre (decisão do mantenedor, só no computador dele) |
| Aluno cadastrado (Fase 4) | o que cada um escolher mostrar, com **consentimento explícito e revogável** |

## Compromissos
- Antes de publicar o site em endereço público, decidir e documentar: base legal (LGPD), aviso de origem dos dados,
  canal de remoção e se nomes de quem não se cadastrou aparecem. Enquanto isso, nada de nomes em deploy público.
- Identificadores expostos usam HMAC com segredo em variável de ambiente (nunca hash simples) quando existirem.
- Pedido de remoção é atendido sem justificativa.
