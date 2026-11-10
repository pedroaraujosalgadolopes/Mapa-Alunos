/**
 * Tempos de viagem entre cidades.
 * Terra (trem/ônibus, dado real): minutos (>= 0), SEM_DADO ou ALEM_DO_LIMITE.
 * Estimativas (ônibus em trechos curtos, voo em trechos longos): sempre marcadas, em arquivos separados, só entram se o
 * usuário quiser e aparecem com ícone e "estimado". Vale o MENOR tempo entre o real e a estimativa.
 */
export const SEM_DADO = -1;
export const ALEM_DO_LIMITE = -2;

type Mapa = Record<string, Record<string, number>>;

export type ModoEstimado = "onibus" | "voo";

export interface Tempos {
  fonte: "transitous" | "simulado" | "estimativa";
  pares: Mapa; // terra (dado real), simétrico
  estimados: Record<string, Record<string, Efetivo & { modo: ModoEstimado }>>; // estimativas, simétrico
}

export interface LinhaTempo {
  origem_cidade_id: string;
  destino_cidade_id: string;
  minutos: string;
  status: string;
  fonte: string;
  modo?: string;
}

export type Modo = "terra" | ModoEstimado;
export interface Efetivo { min: number; modo: Modo }

function simetrico(m: Mapa, a: string, b: string, v: number) {
  (m[a] ??= {})[b] = v;
  (m[b] ??= {})[a] = v;
}

const MODO_ESTIMADO: Record<string, ModoEstimado> = { voo_estimado: "voo", onibus_estimado: "onibus" };

/**
 * Une as duas direções de cada par: vale o MENOR tempo conhecido. Os dados abertos de transporte são incompletos, então
 * cada direção é um limite superior do tempo real; o menor é o mais próximo da realidade. Estimativas ficam em `estimados`.
 */
export function montarTempos(linhas: LinhaTempo[]): Tempos | null {
  if (!linhas.length) return null;
  const estim = linhas.filter((l) => l.modo && l.modo in MODO_ESTIMADO);
  const terra = linhas.filter((l) => !(l.modo && l.modo in MODO_ESTIMADO));
  const fonte = terra.length ? (terra[0].fonte === "simulado" ? "simulado" : "transitous") : "estimativa";
  const agrupa = (ls: LinhaTempo[]) => {
    const acc = new Map<string, number[]>();
    for (const l of ls) {
      const v = l.status === "ok" || l.status === "estimado" ? Number(l.minutos) : l.status === "alem_do_limite" ? ALEM_DO_LIMITE : SEM_DADO;
      const chave = [l.origem_cidade_id, l.destino_cidade_id].sort().join("|");
      acc.set(chave, [...(acc.get(chave) ?? []), v]);
    }
    return acc;
  };
  const pares: Mapa = {};
  for (const [chave, vs] of agrupa(terra)) {
    const [a, b] = chave.split("|");
    const ok = vs.filter((v) => v >= 0);
    simetrico(pares, a, b, ok.length ? Math.min(...ok) : vs.includes(ALEM_DO_LIMITE) ? ALEM_DO_LIMITE : SEM_DADO);
  }
  const estimados: Tempos["estimados"] = {};
  for (const l of estim) {
    const min = Number(l.minutos);
    if (!(min >= 0)) continue;
    const modo = MODO_ESTIMADO[l.modo!];
    for (const [x, y] of [[l.origem_cidade_id, l.destino_cidade_id], [l.destino_cidade_id, l.origem_cidade_id]]) {
      const atual = estimados[x]?.[y];
      if (!atual || min < atual.min) (estimados[x] ??= {})[y] = { min, modo };
    }
  }
  return { fonte, pares, estimados };
}

/** Melhor tempo conhecido entre duas cidades. Com `estimativas`, a estimativa vale se for mais rápida ou se não há tempo real. */
export function efetivo(t: Tempos, a: string, b: string, estimativas = true): Efetivo | undefined {
  const terra = t.pares[a]?.[b];
  const est = estimativas ? t.estimados[a]?.[b] : undefined;
  if (terra !== undefined && terra >= 0) return est && est.min < terra ? { min: est.min, modo: est.modo } : { min: terra, modo: "terra" };
  if (est) return { min: est.min, modo: est.modo };
  return terra === undefined ? undefined : { min: terra, modo: "terra" };
}

export const icone = (modo: Modo): string => (modo === "voo" ? "✈ " : modo === "onibus" ? "🚌 " : "");

export const minutosEntre = (t: Tempos, a: string, b: string, estimativas = true): number | undefined => efetivo(t, a, b, estimativas)?.min;

export function fmtDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Cidades com tempo conhecido a partir de `origem`, mais perto primeiro; `maxMin` opcional filtra o raio. */
export function vizinhos(t: Tempos, origem: string, ids: string[], maxMin: number | null = null, estimativas = true): (Efetivo & { id: string })[] {
  const lista: (Efetivo & { id: string })[] = [];
  for (const id of ids) {
    if (id === origem) continue;
    const e = efetivo(t, origem, id, estimativas);
    if (e && e.min >= 0 && (maxMin === null || e.min <= maxMin)) lista.push({ id, ...e });
  }
  return lista.sort((x, y) => x.min - y.min || x.id.localeCompare(y.id));
}

/** Componentes conexos: duas cidades ficam no mesmo grupo se há caminho de arestas com tempo <= corte. */
export function componentes(ids: string[], t: Tempos, corteMin: number, estimativas = true): string[][] {
  const pai = new Map(ids.map((i) => [i, i]));
  const raiz = (x: string): string => (pai.get(x) === x ? x : (pai.set(x, raiz(pai.get(x)!)), pai.get(x)!));
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const m = minutosEntre(t, ids[i], ids[j], estimativas);
      if (m !== undefined && m >= 0 && m <= corteMin) pai.set(raiz(ids[i]), raiz(ids[j]));
    }
  const grupos = new Map<string, string[]>();
  for (const id of ids) grupos.set(raiz(id), [...(grupos.get(raiz(id)) ?? []), id]);
  return [...grupos.values()].sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}
