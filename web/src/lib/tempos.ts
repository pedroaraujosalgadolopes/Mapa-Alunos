/** Tempos de viagem entre cidades. Pares: minutos (>= 0), SEM_DADO ou ALEM_DO_LIMITE. Nunca estimamos. */
export const SEM_DADO = -1;
export const ALEM_DO_LIMITE = -2;

export interface Tempos {
  fonte: "transitous" | "simulado";
  pares: Record<string, Record<string, number>>; // simétrico: pares[a][b] === pares[b][a]
}

export interface LinhaTempo {
  origem_cidade_id: string;
  destino_cidade_id: string;
  minutos: string;
  status: string;
  fonte: string;
}

/** Une as duas direções de cada par: vale o MAIOR tempo (conservador); sem tempo, sem dado/além do limite. */
export function montarTempos(linhas: LinhaTempo[]): Tempos | null {
  if (!linhas.length) return null;
  const fonte = linhas[0].fonte === "simulado" ? "simulado" : "transitous";
  const acc = new Map<string, number[]>();
  for (const l of linhas) {
    const v = l.status === "ok" ? Number(l.minutos) : l.status === "alem_do_limite" ? ALEM_DO_LIMITE : SEM_DADO;
    const chave = [l.origem_cidade_id, l.destino_cidade_id].sort().join("|");
    acc.set(chave, [...(acc.get(chave) ?? []), v]);
  }
  const pares: Tempos["pares"] = {};
  for (const [chave, vs] of acc) {
    const [a, b] = chave.split("|");
    const ok = vs.filter((v) => v >= 0);
    const v = ok.length ? Math.max(...ok) : vs.includes(ALEM_DO_LIMITE) ? ALEM_DO_LIMITE : SEM_DADO;
    (pares[a] ??= {})[b] = v;
    (pares[b] ??= {})[a] = v;
  }
  return { fonte, pares };
}

export const minutosEntre = (t: Tempos, a: string, b: string): number | undefined => t.pares[a]?.[b];

export function fmtDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Cidades com tempo conhecido a partir de `origem`, mais perto primeiro; `maxMin` opcional filtra o raio. */
export function vizinhos(t: Tempos, origem: string, ids: string[], maxMin: number | null = null): { id: string; min: number }[] {
  return ids
    .filter((id) => id !== origem)
    .map((id) => ({ id, min: minutosEntre(t, origem, id) ?? SEM_DADO }))
    .filter((v) => v.min >= 0 && (maxMin === null || v.min <= maxMin))
    .sort((x, y) => x.min - y.min || x.id.localeCompare(y.id));
}

/** Componentes conexos: duas cidades ficam no mesmo grupo se há caminho de arestas com tempo <= corte. */
export function componentes(ids: string[], t: Tempos, corteMin: number): string[][] {
  const pai = new Map(ids.map((i) => [i, i]));
  const raiz = (x: string): string => (pai.get(x) === x ? x : (pai.set(x, raiz(pai.get(x)!)), pai.get(x)!));
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const m = minutosEntre(t, ids[i], ids[j]);
      if (m !== undefined && m >= 0 && m <= corteMin) pai.set(raiz(ids[i]), raiz(ids[j]));
    }
  const grupos = new Map<string, string[]>();
  for (const id of ids) grupos.set(raiz(id), [...(grupos.get(raiz(id)) ?? []), id]);
  return [...grupos.values()].sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}
