"use client";

import { useMemo, useState } from "react";
import { contarCidade } from "@/lib/filtro";
import { t } from "@/lib/i18n";
import { tokens } from "@/lib/tokens";
import type { Filtros, Nomes, Resumo } from "@/lib/types";
import Faixa from "./Faixa";
import FiltrosView from "./Filtros";
import MapView, { type No } from "./MapView";
import Painel from "./Painel";

export default function App({ resumo, fonte, nomes, apresentacao }: {
  resumo: Resumo; fonte: "real" | "sintetico"; nomes: Nomes | null; apresentacao: boolean }) {
  const [filtros, setFiltros] = useState<Filtros>({ semestre: "", pais: "" });
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const opcoes = useMemo(() => {
    const sem = new Set<string>(), paises = new Set<string>();
    for (const c of resumo.cidades) {
      if (c.pais) paises.add(c.pais);
      for (const i of c.instituicoes) {
        Object.keys(i.por_semestre).forEach((s) => sem.add(s));
      }
    }
    const ord = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { semestres: ord(sem), paises: ord(paises) };
  }, [resumo]);

  const nos = useMemo<No[]>(
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
  const cidade = resumo.cidades.find((c) => c.cidade_id === selecionada) ?? null;

  return (
    <>
      <Faixa resumo={resumo} fonte={fonte} apresentacao={apresentacao} />
      <div className="app">
        <aside className="lateral">
          <h1>{t("titulo")}</h1>
          <FiltrosView filtros={filtros} onChange={setFiltros} opcoes={opcoes}
            resultado={{ alunos: nos.reduce((s, n) => s + n.n, 0), cidades: nos.length }} />
          <section>
            <h2>{t("legenda.titulo")}</h2>
            <div className="legenda">
              <span style={{ "--c": tokens.color.nodeDefault } as React.CSSProperties}>{t("legenda.padrao")}</span>
              <span style={{ "--c": tokens.color.nodePendente } as React.CSSProperties}>{t("legenda.pendente")}</span>
              <span style={{ "--c": tokens.color.nodeFora } as React.CSSProperties}>{t("legenda.fora")}</span>
            </div>
          </section>
          <Painel cidade={cidade} k={resumo.k_min} nomes={nomes} semestres={opcoes.semestres} onFechar={() => setSelecionada(null)} />
          <p className="nota">{t("rodape.dados")}</p>
        </aside>
        <main className="mapa">
          <MapView nos={nos} selecionada={selecionada} onSelect={setSelecionada} />
        </main>
      </div>
    </>
  );
}
