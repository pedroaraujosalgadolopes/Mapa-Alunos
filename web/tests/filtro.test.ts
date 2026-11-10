import assert from "node:assert/strict";
import { test } from "node:test";
import { contar, contarCidade } from "../src/lib/filtro.ts";
import type { Cidade, Instituicao } from "../src/lib/types.ts";

const inst = (porSemestre: Record<string, number>): Instituicao => ({
  instituicao_id: "x", nome: "X", campus_status: "unico", total: Object.values(porSemestre).reduce((a, b) => a + b, 0),
  por_semestre: porSemestre, cursos: null,
});
const cidade = (pais: string, ...insts: Instituicao[]): Cidade => ({
  cidade_id: "c", cidade: "C", pais, iso2: null, regiao_id: "europa", regiao_ativa: true, lat: 0, lon: 0, campus_pendente: false,
  total: insts.reduce((a, i) => a + i.total, 0), instituicoes: insts,
});

test("meu semestre: só conta quem está no semestre escolhido", () => {
  const i = inst({ "2027.2": 2, "2028.1": 3 });
  assert.equal(contar(i, { semestre: "", pais: "" }), 5);
  assert.equal(contar(i, { semestre: "2027.2", pais: "" }), 2);
  assert.equal(contar(i, { semestre: "2028.1", pais: "" }), 3);
  assert.equal(contar(inst({ "2028.1": 4 }), { semestre: "2027.2", pais: "" }), 0); // ninguém nesse semestre
});

test("cidade soma instituições e respeita semestre e país", () => {
  const c = cidade("Portugal", inst({ "2027.2": 1, "2028.1": 2 }), inst({ "2027.2": 3 }));
  assert.equal(contarCidade(c, { semestre: "2027.2", pais: "" }), 4);
  assert.equal(contarCidade(c, { semestre: "2028.1", pais: "" }), 2);
  assert.equal(contarCidade(c, { semestre: "2027.2", pais: "Espanha" }), 0);
});
