import { contar, porSemestre } from "@/lib/filtro";
import { t } from "@/lib/i18n";
import type { Filtros, Nomes, Resumo } from "@/lib/types";

/** Tudo numa lista só: cidade → instituição → alunos (com nomes, se permitido) ou contagens por área. */
export default function Lista({ resumo, nomes, filtros, onSelect }: {
  resumo: Resumo; nomes: Nomes | null; filtros: Filtros; onSelect: (id: string) => void }) {
  const cidades = resumo.cidades
    .filter((c) => (!filtros.pais || c.pais === filtros.pais))
    .map((c) => ({ c, insts: c.instituicoes.filter((i) => contar(i, filtros) > 0) }))
    .filter(({ insts }) => insts.length)
    .sort((a, b) => (a.c.pais ?? "").localeCompare(b.c.pais ?? "", "pt-BR") || (a.c.cidade ?? "").localeCompare(b.c.cidade ?? "", "pt-BR"));
  return (
    <div className="lista">
      {cidades.map(({ c, insts }) => (
        <section key={c.cidade_id}>
          <h2><button className="link" onClick={() => onSelect(c.cidade_id)}>{c.cidade}</button> <span className="nota">{c.pais}</span></h2>
          {insts.map((i) => {
            const gente = (nomes?.[i.instituicao_id] ?? {});
            const pessoas = Object.entries(gente).flatMap(([s, ps]) => ps.map((p) => ({ ...p, s })))
              .filter((p) => (!p.cidade_id || p.cidade_id === c.cidade_id) && (!filtros.semestre || p.s === filtros.semestre) && (!filtros.area || p.area === filtros.area));
            return (
              <article key={i.instituicao_id} className="inst">
                <h3>{i.nome} <span className="nota">· {contar(i, filtros)}</span></h3>
                {nomes ? (
                  <table><tbody>
                    {pessoas.map((p, n) => (
                      <tr key={n}><td><strong>{p.nome}</strong></td><td>{p.curso}</td><td className="nota">{p.area}</td><td>{p.s}</td></tr>
                    ))}
                  </tbody></table>
                ) : i.areas ? (
                  <ul className="cursos">
                    {Object.entries(porSemestre(i, filtros)).map(([s, n]) => <li key={s}>{s}: {n}</li>)}
                  </ul>
                ) : <p className="nota">{t("painel.ocultoPrivacidade")}</p>}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
