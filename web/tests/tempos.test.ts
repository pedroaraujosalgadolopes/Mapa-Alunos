import assert from "node:assert/strict";
import { test } from "node:test";
import { ALEM_DO_LIMITE, SEM_DADO, componentes, fmtDuracao, montarTempos, vizinhos } from "../src/lib/tempos.ts";

const L = (o: string, d: string, minutos: string, status = "ok", fonte = "transitous") =>
  ({ origem_cidade_id: o, destino_cidade_id: d, minutos, status, fonte });

test("une as duas direções com o maior tempo e fica simétrico", () => {
  const t = montarTempos([L("a", "b", "60"), L("b", "a", "70"), L("a", "c", "", "sem_dado"), L("c", "a", "", "alem_do_limite")])!;
  assert.equal(t.pares.a.b, 70);
  assert.equal(t.pares.b.a, 70);
  assert.equal(t.pares.a.c, ALEM_DO_LIMITE); // sem tempo conhecido: além do limite tem precedência sobre sem dado
});

test("um lado com dado e outro sem: usa o que existe", () => {
  const t = montarTempos([L("a", "b", "90"), L("b", "a", "", "sem_dado")])!;
  assert.equal(t.pares.a.b, 90);
  assert.equal(montarTempos([L("a", "b", "", "sem_dado")])!.pares.a.b, SEM_DADO);
});

test("sem linhas não há tempos; fonte simulada é preservada", () => {
  assert.equal(montarTempos([]), null);
  assert.equal(montarTempos([L("a", "b", "10", "ok", "simulado")])!.fonte, "simulado");
});

test("formata duração", () => {
  assert.equal(fmtDuracao(45), "45 min");
  assert.equal(fmtDuracao(120), "2h");
  assert.equal(fmtDuracao(205), "3h25");
});

test("vizinhos: ordena, aplica raio e ignora sem dado", () => {
  const t = montarTempos([L("a", "b", "200"), L("a", "c", "50"), L("a", "d", "", "sem_dado"), L("a", "e", "400")])!;
  assert.deepEqual(vizinhos(t, "a", ["a", "b", "c", "d", "e"]).map((v) => v.id), ["c", "b", "e"]);
  assert.deepEqual(vizinhos(t, "a", ["a", "b", "c", "d", "e"], 200).map((v) => v.id), ["c", "b"]);
});

test("componentes por corte de horas (conexão transitiva)", () => {
  const t = montarTempos([L("a", "b", "60"), L("b", "c", "60"), L("a", "c", "300"), L("c", "d", "500")])!;
  assert.deepEqual(componentes(["a", "b", "c", "d"], t, 120), [["a", "b", "c"], ["d"]]);
  assert.deepEqual(componentes(["a", "b", "c", "d"], t, 30).length, 4);
  assert.equal(componentes(["a", "b", "c", "d"], t, 600).length, 1);
});
