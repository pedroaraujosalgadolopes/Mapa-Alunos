import type { Cidade, Filtros, Instituicao } from "./types";

/** Alunos de uma instituição que passam nos filtros. Grupo oculto (<3) não entra no filtro por curso. */
export function contar(i: Instituicao, f: Filtros): number {
  if (f.curso) {
    if (!i.cursos) return 0;
    if (f.semestre) return i.cursos_por_semestre?.[f.semestre]?.[f.curso] ?? 0;
    return i.cursos[f.curso] ?? 0;
  }
  return f.semestre ? (i.por_semestre[f.semestre] ?? 0) : i.total;
}

export function contarCidade(c: Cidade, f: Filtros): number {
  if (f.pais && c.pais !== f.pais) return 0;
  return c.instituicoes.reduce((s, i) => s + contar(i, f), 0);
}
