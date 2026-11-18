import type { Cidade, Filtros, Instituicao } from "./types";

/** Alunos de uma instituição por semestre, respeitando o filtro de área.
 *  Com área escolhida, grupos pequenos (sem `areas` por privacidade) não contam. */
export function porSemestre(i: Instituicao, f: Pick<Filtros, "area">): Record<string, number> {
  if (!f.area) return i.por_semestre;
  return i.areas?.[f.area] ?? {};
}

/** Alunos de uma instituição que passam nos filtros (semestre e área). */
export function contar(i: Instituicao, f: Filtros): number {
  const ps = porSemestre(i, f);
  return f.semestre ? (ps[f.semestre] ?? 0) : Object.values(ps).reduce((a, b) => a + b, 0);
}

export function contarCidade(c: Cidade, f: Filtros): number {
  if (f.pais && c.pais !== f.pais) return 0;
  return c.instituicoes.reduce((s, i) => s + contar(i, f), 0);
}
