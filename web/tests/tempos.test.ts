import assert from "node:assert/strict";
import { test } from "node:test";
import { ALEM_DO_LIMITE, SEM_DADO, componentes, efetivo, fmtDuracao, montarTempos, vizinhos } from "../src/lib/tempos.ts";

const L = (o: string, d: string, minutos: string, status = "ok", fonte = "transitous", modo = "trem_onibus") =>
  ({ origem_cidade_id: o, destino_cidade_id: d, minutos, status, fonte, modo });
const V = (o: string, d: string, minutos: string) => L(o, d, minutos, "estimado", "estimativa", "voo_estimado");

test("une as duas direções com o maior tempo e fica simétrico", () => {
  const t = montarTempos([L("a", "b", "60"), L("b", "a", "70"), L("a", "c", "", "sem_dado"), L("c", "a", "", "alem_do_limite")])!;
  assert.equal(t.pares.a.b, 70);
  assert.equal(t.pares.b.a, 70);
  assert.equal(t.pares.a.c, ALEM_DO_LIMITE); // sem tempo conhecido: além do limite tem precedência sobre sem dado
});

test("um lado com dado e outro sem: usa o que existe", () => {
  assert.equal(montarTempos([L("a", "b", "90"), L("b", "a", "", "sem_dado")])!.pares.a.b, 90);
  assert.equal(montarTempos([L("a", "b", "", "sem_dado")])!.pares.a.b, SEM_DADO);
});

test("sem linhas não há tempos; fonte simulada é preservada; só voos = fonte estimativa", () => {
  assert.equal(montarTempos([]), null);
  assert.equal(montarTempos([L("a", "b", "10", "ok", "simulado")])!.fonte, "simulado");
  assert.equal(montarTempos([V("a", "b", "300")])!.fonte, "estimativa");
});

test("voo estimado cobre trecho além do limite e só vale se for mais rápido que a terra", () => {
  const t = montarTempos([L("a", "b", "", "alem_do_limite"), V("a", "b", "300"), L("a", "c", "120"), V("a", "c", "400"), L("a", "d", "600"), V("a", "d", "300")])!;
  assert.deepEqual(efetivo(t, "a", "b", true), { min: 300, modo: "voo" });
  assert.deepEqual(efetivo(t, "a", "b", false), { min: ALEM_DO_LIMITE, modo: "terra" }); // sem voos: continua "além do limite", nunca inventado
  assert.deepEqual(efetivo(t, "a", "c", true), { min: 120, modo: "terra" });
  assert.deepEqual(efetivo(t, "d", "a", true), { min: 300, modo: "voo" });
  assert.equal(efetivo(t, "a", "z", true), undefined);
});

test("formata duração", () => {
  assert.equal(fmtDuracao(45), "45 min");
  assert.equal(fmtDuracao(120), "2h");
  assert.equal(fmtDuracao(205), "3h25");
});

test("vizinhos: ordena, aplica raio, ignora sem dado e respeita o liga/desliga de voos", () => {
  const t = montarTempos([L("a", "b", "200"), L("a", "c", "50"), L("a", "d", "", "sem_dado"), L("a", "e", "", "alem_do_limite"), V("a", "e", "350")])!;
  const ids = ["a", "b", "c", "d", "e"];
  assert.deepEqual(vizinhos(t, "a", ids).map((v) => v.id), ["c", "b", "e"]);
  assert.deepEqual(vizinhos(t, "a", ids, 200).map((v) => v.id), ["c", "b"]);
  assert.deepEqual(vizinhos(t, "a", ids, null, false).map((v) => v.id), ["c", "b"]);
  assert.equal(vizinhos(t, "a", ids).find((v) => v.id === "e")!.modo, "voo");
});

test("componentes por corte de horas (conexão transitiva), com e sem voos", () => {
  const t = montarTempos([L("a", "b", "60"), L("b", "c", "60"), L("a", "c", "300"), L("c", "d", "", "alem_do_limite"), V("c", "d", "400")])!;
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(componentes(ids, t, 120, false), [["a", "b", "c"], ["d"]]);
  assert.deepEqual(componentes(ids, t, 120, true), [["a", "b", "c"], ["d"]]); // voo de 400 min > corte
  assert.equal(componentes(ids, t, 480, true).length, 1);
  assert.equal(componentes(ids, t, 480, false).length, 2);
  assert.equal(componentes(ids, t, 30).length, 4);
});
