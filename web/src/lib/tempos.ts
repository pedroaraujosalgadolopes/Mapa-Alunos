/**
 * Tempos de viagem entre cidades.
 * Terra (trem/ônibus, dado real): minutos (>= 0), SEM_DADO ou ALEM_DO_LIMITE. Voo: ESTIMATIVA marcada, sempre separada.
 * Nunca inventamos tempo de terra; o voo só entra se o usuário quiser (e aparece com ✈ e "estimado").
 */
export const SEM_DADO = -1;
export const ALEM_DO_LIMITE = -2;

type Mapa = Record<string, Record<string, number>>;

export interface Tempos {
  fonte: "transitous" | "simulado" | "estimativa";
  pares: Mapa; // terra, simétrico
  voos: Mapa; // estimativa de voo, simétrico
}

export interface LinhaTempo {
  origem_cidade_id: string;
  destino_cidade_id: string;
  minutos: string;
  status: string;
  fonte: string;
  modo?: string;
}

export type Modo = "terra" | "voo";
export interface Efetivo { min: number; modo: Modo }

function simetrico(m: Mapa, a: string, b: string, v: number) {
  (m[a] ??= {})[b] = v;
  (m[b] ??= {})[a] = v;
}

/**
 * Une as duas direções de cada par: vale o MENOR tempo conhecido. Os dados abertos de transporte são incompletos, então
 * cada direção é um limite superior do tempo real; o menor é o mais próximo da realidade. Voos ficam em `voos`.
 */
export function montarTempos(linhas: LinhaTempo[]): Tempos | null {
  if (!linhas.length) return null;
  const terra = linhas.filter((l) => l.modo !== "voo_estimado");
  const voo = linhas.filter((l) => l.modo === "voo_estimado");
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
  const pares: Mapa = {}, voos: Mapa = {};
  for (const [chave, vs] of agrupa(terra)) {
    const [a, b] = chave.split("|");
    const ok = vs.filter((v) => v >= 0);
    simetrico(pares, a, b, ok.length ? Math.min(...ok) : vs.includes(ALEM_DO_LIMITE) ? ALEM_DO_LIMITE : SEM_DADO);
  }
  for (const [chave, vs] of agrupa(voo)) {
    const [a, b] = chave.split("|");
    const ok = vs.filter((v) => v >= 0);
    if (ok.length) simetrico(voos, a, b, Math.min(...ok));
  }
  return { fonte, pares, voos };
}

/** Melhor tempo conhecido entre duas cidades. Com `voos`, o voo estimado vale se for mais rápido ou se não há terra. */
export function efetivo(t: Tempos, a: string, b: string, voos = true): Efetivo | undefined {
  const terra = t.pares[a]?.[b];
  const voo = voos ? t.voos[a]?.[b] : undefined;
  if (terra !== undefined && terra >= 0) return voo !== undefined && voo < terra ? { min: voo, modo: "voo" } : { min: terra, modo: "terra" };
  if (voo !== undefined) return { min: voo, modo: "voo" };
  return terra === undefined ? undefined : { min: terra, modo: "terra" };
}

export const minutosEntre = (t: Tempos, a: string, b: string, voos = true): number | undefined => efetivo(t, a, b, voos)?.min;

export function fmtDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Cidades com tempo conhecido a partir de `origem`, mais perto primeiro; `maxMin` opcional filtra o raio. */
export function vizinhos(t: Tempos, origem: string, ids: string[], maxMin: number | null = null, voos = true): (Efetivo & { id: string })[] {
  const lista: (Efetivo & { id: string })[] = [];
  for (const id of ids) {
    if (id === origem) continue;
    const e = efetivo(t, origem, id, voos);
    if (e && e.min >= 0 && (maxMin === null || e.min <= maxMin)) lista.push({ id, ...e });
  }
  return lista.sort((x, y) => x.min - y.min || x.id.localeCompare(y.id));
}

/** Componentes conexos: duas cidades ficam no mesmo grupo se há caminho de arestas com tempo <= corte. */
export function componentes(ids: string[], t: Tempos, corteMin: number, voos = true): string[][] {
  const pai = new Map(ids.map((i) => [i, i]));
  const raiz = (x: string): string => (pai.get(x) === x ? x : (pai.set(x, raiz(pai.get(x)!)), pai.get(x)!));
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const m = minutosEntre(t, ids[i], ids[j], voos);
      if (m !== undefined && m >= 0 && m <= corteMin) pai.set(raiz(ids[i]), raiz(ids[j]));
    }
  const grupos = new Map<string, string[]>();
  for (const id of ids) grupos.set(raiz(id), [...(grupos.get(raiz(id)) ?? []), id]);
  return [...grupos.values()].sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}
