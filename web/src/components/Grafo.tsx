"use client";

import { drag } from "d3-drag";
import { type SimulationLinkDatum, type SimulationNodeDatum, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import { select } from "d3-selection";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { t } from "@/lib/i18n";
import { type Tempos, componentes, efetivo, fmtDuracao } from "@/lib/tempos";
import { tokens } from "@/lib/tokens";

export interface NoGrafo { id: string; nome: string; n: number }
interface Sim extends SimulationNodeDatum { id: string; nome: string; n: number }
interface Aresta extends SimulationLinkDatum<Sim> { min: number; voo: boolean }

const L = 900, A = 620;
const raio = (n: number) => 6 + Math.sqrt(n) * 3;

export default function Grafo(props: {
  nos: NoGrafo[]; tempos: Tempos; voos: boolean; corteH: number; onCorte: (h: number) => void; k: number;
  selecionada: string | null; onSelect: (id: string) => void }) {
  const { nos, tempos, corteH, k, voos } = props;
  const [, redesenha] = useReducer((x: number) => x + 1, 0);
  const sim = useRef<ReturnType<typeof forceSimulation<Sim>> | null>(null);
  const noRef = useRef<Sim[]>([]);
  const arRef = useRef<Aresta[]>([]);
  const svg = useRef<SVGSVGElement>(null);

  const grupos = useMemo(() => {
    const comps = componentes(nos.map((n) => n.id), tempos, corteH * 60, voos);
    const porId = new Map(nos.map((n) => [n.id, n]));
    return comps.map((ids, i) => ({ i, ids, total: ids.reduce((s, id) => s + (porId.get(id)?.n ?? 0), 0) }));
  }, [nos, tempos, corteH, voos]);
  const grupoDe = useMemo(() => new Map(grupos.flatMap((g) => g.ids.map((id) => [id, g] as const))), [grupos]);

  useEffect(() => {
    const antigos = new Map(noRef.current.map((n) => [n.id, n]));
    noRef.current = nos.map((n) => ({ ...n, x: antigos.get(n.id)?.x ?? L / 2 + (Math.random() - 0.5) * 200, y: antigos.get(n.id)?.y ?? A / 2 + (Math.random() - 0.5) * 200 }));
    const arestas: Aresta[] = [];
    for (let i = 0; i < nos.length; i++)
      for (let j = i + 1; j < nos.length; j++) {
        const e = efetivo(tempos, nos[i].id, nos[j].id, voos);
        if (e && e.min >= 0 && e.min <= corteH * 60) arestas.push({ source: nos[i].id, target: nos[j].id, min: e.min, voo: e.modo === "voo" });
      }
    arRef.current = arestas;
    sim.current?.stop();
    const s = forceSimulation<Sim>(noRef.current)
      .force("link", forceLink<Sim, Aresta>(arestas).id((d) => d.id).distance((a) => 30 + a.min * 0.45).strength(0.35))
      .force("charge", forceManyBody().strength(-160))
      .force("x", forceX(L / 2).strength(0.04))
      .force("y", forceY(A / 2).strength(0.06))
      .force("colisao", forceCollide<Sim>((d) => raio(d.n) + 6))
      .on("tick", redesenha);
    sim.current = s;
    return () => { s.stop(); };
  }, [nos, tempos, corteH, voos]);

  // arrastar: liga o d3-drag aos nós a cada renderização de conjunto
  useEffect(() => {
    if (!svg.current) return;
    const comportamento = drag<SVGGElement, Sim>()
      .on("start", (e, d) => { if (!e.active) sim.current?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => { if (!e.active) sim.current?.alphaTarget(0); d.fx = null; d.fy = null; });
    select(svg.current).selectAll<SVGGElement, Sim>("g.no").data(noRef.current, (d) => d.id).call(comportamento);
  }, [nos, tempos, corteH, voos]);

  const cor = (id: string) => {
    const g = grupoDe.get(id);
    return !g || g.total < k ? tokens.color.isolado : tokens.color.avatarPalette[g.i % tokens.color.avatarPalette.length];
  };

  return (
    <div className="grafo">
      <div className="grafo-controles">
        <label>
          {t("grafo.corte", { h: corteH })}
          <input type="range" min={1} max={10} step={1} value={corteH} onChange={(e) => props.onCorte(Number(e.target.value))} />
        </label>
        <span className="nota">{t("grafo.dica")}</span>
      </div>
      <svg ref={svg} viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Grafo de cidades">
        {arRef.current.map((a, i) => {
          const s = a.source as Sim, d = a.target as Sim;
          return s.x === undefined || d.x === undefined ? null : (
            <line key={i} x1={s.x} y1={s.y} x2={d.x} y2={d.y} stroke={tokens.color.aresta} strokeOpacity={0.4} strokeWidth={1.5} strokeDasharray={a.voo ? "5 4" : undefined}>
              <title>{`${s.nome} ↔ ${d.nome}: ${a.voo ? "✈ " : ""}~${fmtDuracao(a.min)}${a.voo ? ` (${t("grafo.voo")})` : ""}`}</title>
            </line>
          );
        })}
        {noRef.current.map((d) => {
          const g = grupoDe.get(d.id);
          const isolado = !g || g.total < k;
          return (
            <g key={d.id} className="no" transform={`translate(${d.x ?? 0},${d.y ?? 0})`} onClick={() => props.onSelect(d.id)}>
              <circle r={raio(d.n)} fill={cor(d.id)} fillOpacity={0.85} stroke={d.id === props.selecionada ? tokens.color.nodeSelecionado : "#fff"}
                strokeWidth={d.id === props.selecionada ? 3 : 1.5} strokeDasharray={isolado ? "3 2" : undefined} />
              <text y={-raio(d.n) - 3} textAnchor="middle" fontSize={11} fill={tokens.color.text}>{d.nome}</text>
              <title>{`${d.nome}: ${t("grafo.alunosN", { n: d.n })}`}</title>
            </g>
          );
        })}
      </svg>
      <div className="grafo-grupos">
        <strong>{t("grafo.grupos")}</strong>
        <ul>
          {grupos.map((g) => (
            <li key={g.i} style={{ "--c": g.total < k ? tokens.color.isolado : tokens.color.avatarPalette[g.i % tokens.color.avatarPalette.length] } as React.CSSProperties}>
              <span className="ponto" />
              {g.ids.map((id) => nos.find((n) => n.id === id)?.nome).join(", ")} <span className="nota">· {t("grafo.alunosN", { n: g.total })}
                {g.total < k && <> · <strong>{t("grafo.isolado", { k })}</strong></>}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
