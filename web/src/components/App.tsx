"use client";

import { useEffect, useMemo, useState } from "react";
import { contarCidade } from "@/lib/filtro";
import { t } from "@/lib/i18n";
import { type Tempos, minutosEntre, vizinhos as vizinhosDe } from "@/lib/tempos";
import { tokens } from "@/lib/tokens";
import type { Filtros, Nomes, Resumo } from "@/lib/types";
import Faixa from "./Faixa";
import FiltrosView from "./Filtros";
import Grafo from "./Grafo";
import MapView, { type ArestaMapa, type No } from "./MapView";
import Painel, { type Vizinho } from "./Painel";

const MAIS_PROXIMAS = 5;

export default function App({ resumo, fonte, nomes, tempos, apresentacao }: {
  resumo: Resumo; fonte: "real" | "sintetico"; nomes: Nomes | null; tempos: Tempos | null; apresentacao: boolean }) {
  const [filtros, setFiltros] = useState<Filtros>({ semestre: "", pais: "" });
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [raioH, setRaioH] = useState(0); // 0 = sem limite
  const [aba, setAba] = useState<"mapa" | "grafo">("mapa");
  const [corteH, setCorteH] = useState(3);

  const opcoes = useMemo(() => {
    const sem = new Set<string>(), paises = new Set<string>();
    for (const c of resumo.cidades) {
      if (c.pais) paises.add(c.pais);
      for (const i of c.instituicoes) Object.keys(i.por_semestre).forEach((s) => sem.add(s));
    }
    const ord = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { semestres: ord(sem), paises: ord(paises) };
  }, [resumo]);

  const todos = useMemo<No[]>(
    () =>
      resumo.cidades
        .map((c) => ({ c, n: contarCidade(c, filtros) }))
        .filter(({ n }) => n > 0)
        .map(({ c, n }) => ({
          id: c.cidade_id, nome: c.cidade ?? c.cidade_id, pais: c.pais ?? "", n, lat: c.lat!, lon: c.lon!,
          tipo: !c.regiao_ativa ? "fora" : c.campus_pendente ? "pendente" : "padrao",
        })),
    [resumo, filtros],
  );
  const porId = useMemo(() => new Map(resumo.cidades.map((c) => [c.cidade_id, c])), [resumo]);
  const ids = useMemo(() => todos.map((n) => n.id), [todos]);

  // "perto de mim": a cidade selecionada é a origem; vizinhos pelo tempo conhecido
  const perto = useMemo(() => {
    if (!tempos || !selecionada) return null;
    const todosPerto = vizinhosDe(tempos, selecionada, ids, raioH ? raioH * 60 : null);
    return raioH ? todosPerto : todosPerto.slice(0, MAIS_PROXIMAS);
  }, [tempos, selecionada, ids, raioH]);

  const nos = useMemo(() => {
    if (!tempos || !selecionada || !raioH) return todos;
    const dentro = new Set([selecionada, ...(perto ?? []).map((v) => v.id)]);
    return todos.filter((n) => dentro.has(n.id));
  }, [todos, tempos, selecionada, raioH, perto]);

  const arestas = useMemo<ArestaMapa[]>(() => {
    const o = selecionada ? porId.get(selecionada) : null;
    if (!tempos || !o || !perto) return [];
    return perto.map((v) => {
      const d = porId.get(v.id)!;
      return { id: `${o.cidade_id}-${d.cidade_id}`, de: [o.lon!, o.lat!], para: [d.lon!, d.lat!], min: v.min };
    });
  }, [tempos, selecionada, perto, porId]);

  const listaVizinhos = useMemo<Vizinho[] | null>(
    () => perto && perto.map((v) => {
      const c = porId.get(v.id)!;
      return { id: v.id, nome: c.cidade ?? v.id, pais: c.pais ?? "", iso2: c.iso2, n: todos.find((x) => x.id === v.id)?.n ?? 0, min: v.min };
    }),
    [perto, porId, todos],
  );

  useEffect(() => { if (!selecionada) setRaioH(0); }, [selecionada]);

  const cidade = selecionada ? porId.get(selecionada) ?? null : null;
  const nosGrafo = useMemo(() => todos.filter((n) => n.tipo !== "fora").map((n) => ({ id: n.id, nome: n.nome, n: n.n })), [todos]);

  return (
    <>
      <Faixa resumo={resumo} fonte={fonte} apresentacao={apresentacao} temposSimulados={tempos?.fonte === "simulado"} />
      <div className="app">
        <aside className="lateral">
          <h1>{t("titulo")}</h1>
          <FiltrosView filtros={filtros} onChange={setFiltros} opcoes={opcoes}
            resultado={{ alunos: nos.reduce((s, n) => s + n.n, 0), cidades: nos.length }} />
          <section>
            <h2>{t("raio.titulo")}</h2>
            {tempos ? (
              <label className="campo">
                {cidade ? `${cidade.cidade}` : t("raio.ajuda")}
                <select value={raioH} disabled={!cidade} onChange={(e) => setRaioH(Number(e.target.value))}>
                  <option value={0}>{t("raio.semLimite")}</option>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((h) => <option key={h} value={h}>{t("raio.ate", { h })}</option>)}
                </select>
              </label>
            ) : <p className="nota">{t("raio.semTempos")}</p>}
          </section>
          <section>
            <h2>{t("legenda.titulo")}</h2>
            <div className="legenda">
              <span style={{ "--c": tokens.color.nodeDefault } as React.CSSProperties}>{t("legenda.padrao")}</span>
              <span style={{ "--c": tokens.color.nodePendente } as React.CSSProperties}>{t("legenda.pendente")}</span>
              <span style={{ "--c": tokens.color.nodeFora } as React.CSSProperties}>{t("legenda.fora")}</span>
            </div>
          </section>
          <Painel cidade={cidade} k={resumo.k_min} nomes={nomes} semestres={opcoes.semestres} vizinhos={listaVizinhos} raioH={raioH}
            onFechar={() => setSelecionada(null)} onSelect={setSelecionada} />
          <p className="nota">{t("rodape.dados")}{tempos?.fonte === "transitous" && <> {t("rodape.tempos")}</>}</p>
        </aside>
        <main className="mapa">
          <div className="abas" role="tablist">
            {(["mapa", "grafo"] as const).map((a) => (
              <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "ativa" : ""} onClick={() => setAba(a)}>{t(`abas.${a}`)}</button>
            ))}
          </div>
          <div className="mapa-camada" style={{ visibility: aba === "mapa" ? "visible" : "hidden" }}>
            <MapView nos={nos} arestas={arestas} selecionada={selecionada} onSelect={setSelecionada} />
          </div>
          {aba === "grafo" && (
            <div className="grafo-wrap">
              {tempos ? (
                <Grafo nos={nosGrafo} tempos={tempos} corteH={corteH} onCorte={setCorteH} k={resumo.k_min}
                  selecionada={selecionada} onSelect={setSelecionada} />
              ) : <p className="nota" style={{ padding: 16 }}>{t("grafo.semTempos")}</p>}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
