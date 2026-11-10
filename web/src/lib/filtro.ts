import type { Cidade, Filtros, Instituicao } from "./types";

/** Alunos de uma instituição que passam nos filtros (semestre). */
export function contar(i: Instituicao, f: Filtros): number {
  return f.semestre ? (i.por_semestre[f.semestre] ?? 0) : i.total;
}

export function contarCidade(c: Cidade, f: Filtros): number {
  if (f.pais && c.pais !== f.pais) return 0;
  return c.instituicoes.reduce((s, i) => s + contar(i, f), 0);
}
