"use client";

import { useEffect, useMemo, useState } from "react";
import { contarCidade } from "@/lib/filtro";
import { t } from "@/lib/i18n";
import { type Tempos, distanciaKm, efetivo, fmtDuracao, icone, vizinhos as vizinhosDe } from "@/lib/tempos";
import { tokens } from "@/lib/tokens";
import type { Filtros, Nomes, Resumo } from "@/lib/types";
import Faixa from "./Faixa";
import FiltrosView from "./Filtros";
import Grafo from "./Grafo";
import Lista from "./Lista";
import MapView, { type ArestaMapa, type No } from "./MapView";
import Painel, { type Vizinho } from "./Painel";


export default function App({ resumo, fonte, nomes, tempos, apresentacao }: {
  resumo: Resumo; fonte: "real" | "sintetico"; nomes: Nomes | null; tempos: Tempos | null; apresentacao: boolean }) {
  const [filtros, setFiltros] = useState<Filtros>({ semestre: "", pais: "", area: "" });
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [raioH, setRaioH] = useState(0); // 0 = sem limite
  const [aba, setAba] = useState<"mapa" | "grafo" | "lista">("mapa");
  const [corteH, setCorteH] = useState(3);
  const [estimativas, setEstimativas] = useState(true); // incluir estimativas (ônibus curto, voo)
  const [medir, setMedir] = useState(false); // modo "medir": marcar duas cidades para ver tempo e distância
  const [par, setPar] = useState<string[]>([]);

  const opcoes = useMemo(() => {
    const sem = new Set<string>(), paises = new Set<string>(), areas = new Set<string>();
    for (const c of resumo.cidades) {
      if (c.pais) paises.add(c.pais);
      for (const i of c.instituicoes) {
        Object.keys(i.por_semestre).forEach((s) => sem.add(s));
        Object.keys(i.areas ?? {}).forEach((a) => areas.add(a));
      }
    }
    const ord = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { semestres: ord(sem), paises: ord(paises), areas: ord(areas) };
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
    if (!tempos || !selecionada || !raioH) return null; // só calcula quando a pessoa pede um raio
    return vizinhosDe(tempos, selecionada, ids, raioH * 60, estimativas);
  }, [tempos, selecionada, ids, raioH, estimativas]);

  // cidades com alunos (no filtro) mas sem tempo conhecido a partir da selecionada: mostramos, não escondemos
  const semTempo = useMemo<string[]>(() => {
    if (!tempos || !selecionada) return [];
    return todos
      .filter((n) => n.id !== selecionada && n.tipo !== "fora" && !((efetivo(tempos, selecionada, n.id, estimativas)?.min ?? -1) >= 0))
      .map((n) => n.nome)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tempos, selecionada, todos, estimativas]);

  const nos = useMemo(() => {
    if (!tempos || !selecionada || !raioH) return todos;
    const dentro = new Set([selecionada, ...(perto ?? []).map((v) => v.id)]);
    return todos.filter((n) => dentro.has(n.id));
  }, [todos, tempos, selecionada, raioH, perto]);

  // a única linha no mapa é a da medição entre duas cidades marcadas
  const medicao = useMemo(() => {
    if (!medir || par.length < 2) return null;
    const [a, b] = [porId.get(par[0]), porId.get(par[1])];
    if (!a || !b) return null;
    const e = tempos ? efetivo(tempos, a.cidade_id, b.cidade_id, estimativas) : undefined;
    return { a, b, km: Math.round(distanciaKm({ lat: a.lat!, lon: a.lon! }, { lat: b.lat!, lon: b.lon! })), e: e && e.min >= 0 ? e : null };
  }, [medir, par, porId, tempos, estimativas]);

  const arestas = useMemo<ArestaMapa[]>(() => {
    if (!medicao) return [];
    const { a, b, e, km } = medicao;
    return [{ id: `${a.cidade_id}-${b.cidade_id}`, de: [a.lon!, a.lat!], para: [b.lon!, b.lat!], min: e?.min ?? -1, modo: e?.modo ?? "terra", km }];
  }, [medicao]);

  const aoClicar = (id: string | null) => {
    if (!medir) return setSelecionada(id);
    if (!id) return setPar([]);
    setPar((p) => (p.length === 1 && p[0] !== id ? [p[0], id] : [id]));
  };
  const alternarMedir = () => { setMedir((m) => !m); setPar([]); setSelecionada(null); };
  const verTodos = () => { setSelecionada(null); setRaioH(0); setPar([]); setMedir(false); };

  const listaVizinhos = useMemo<Vizinho[] | null>(
    () => perto && perto.map((v) => {
      const c = porId.get(v.id)!;
      return { id: v.id, nome: c.cidade ?? v.id, pais: c.pais ?? "", iso2: c.iso2, n: todos.find((x) => x.id === v.id)?.n ?? 0, min: v.min, modo: v.modo };
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
            <h2>{t("medir.titulo")}</h2>
            <button className={medir ? "botao ativo" : "botao"} onClick={alternarMedir}>{medir ? t("medir.sair") : t("medir.entrar")}</button>
            {medir && (
              <p className="nota">
                {par.length === 0 && t("medir.marqueA")}
                {par.length === 1 && t("medir.marqueB", { a: porId.get(par[0])?.cidade ?? "" })}
                {medicao && (
                  <>
                    <strong>{medicao.a.cidade} → {medicao.b.cidade}</strong><br />
                    {t("medir.distancia", { km: medicao.km })} · {medicao.e ? <>{icone(medicao.e.modo)}~{fmtDuracao(medicao.e.min)}{medicao.e.modo !== "terra" && <> ({t("vizinhos.estimado")})</>}</> : t("medir.semTempo")}
                  </>
                )}
              </p>
            )}
          </section>
          {selecionada && !medir && <button className="botao" onClick={verTodos}>{t("medir.verTodos")}</button>}
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
            {tempos && (
              <label className="check">
                <input type="checkbox" checked={estimativas} onChange={(e) => setEstimativas(e.target.checked)} /> {t("raio.estimativas")}
              </label>
            )}
          </section>
          <section>
            <h2>{t("legenda.titulo")}</h2>
            <div className="legenda">
              <span style={{ "--c": tokens.color.nodeDefault } as React.CSSProperties}>{t("legenda.padrao")}</span>
              <span style={{ "--c": tokens.color.nodePendente } as React.CSSProperties}>{t("legenda.pendente")}</span>
              <span style={{ "--c": tokens.color.nodeFora } as React.CSSProperties}>{t("legenda.fora")}</span>
            </div>
          </section>
          <Painel cidade={cidade} k={resumo.k_min} nomes={nomes} semestres={opcoes.semestres} semestre={filtros.semestre} area={filtros.area} cursoArea={resumo.curso_area ?? {}} vizinhos={listaVizinhos} semTempo={semTempo} raioH={raioH}
            onFechar={verTodos} onSelect={setSelecionada} />
          <section className="sobre">
            <h2>{t("sobre.titulo")}</h2>
            <p className="nota">{t("sobre.texto")} <a href="https://editais.uff.br/11710" target="_blank" rel="noopener noreferrer">{t("sobre.edital")}</a>.</p>
          </section>
          <p className="nota">{t("rodape.dados")}{tempos?.fonte === "transitous" && <> {t("rodape.tempos")}</>}</p>
        </aside>
        <main className="mapa">
          <div className="abas" role="tablist">
            {(["mapa", "grafo", "lista"] as const).map((a) => (
              <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "ativa" : ""} onClick={() => setAba(a)}>{t(`abas.${a}`)}</button>
            ))}
          </div>
          <div className="mapa-camada" style={{ visibility: aba === "mapa" ? "visible" : "hidden" }}>
            <MapView nos={nos} arestas={arestas} destaque={medir ? par : selecionada ? [selecionada] : []} onSelect={aoClicar} />
          </div>
          {aba === "lista" && (
            <div className="grafo-wrap"><Lista resumo={resumo} nomes={nomes} filtros={filtros} onSelect={(id) => { setSelecionada(id); setAba("mapa"); }} /></div>
          )}
          {aba === "grafo" && (
            <div className="grafo-wrap">
              {tempos ? (
                <Grafo nos={nosGrafo} tempos={tempos} estimativas={estimativas} corteH={corteH} onCorte={setCorteH} k={resumo.k_min}
                  selecionada={medir ? (par[par.length - 1] ?? null) : selecionada} onSelect={aoClicar} />
              ) : <p className="nota" style={{ padding: 16 }}>{t("grafo.semTempos")}</p>}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
