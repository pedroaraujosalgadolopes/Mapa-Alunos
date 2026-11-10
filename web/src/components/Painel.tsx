import { t } from "@/lib/i18n";
import type { Cidade, Nomes } from "@/lib/types";

const contagem = (n: number) => (n === 1 ? t("painel.aluno") : t("painel.alunos", { n }));

export default function Painel({ cidade, k, nomes, onFechar }: { cidade: Cidade | null; k: number; nomes: Nomes | null; onFechar: () => void }) {
  if (!cidade) return <p className="nota">{t("painel.vazio")}</p>;
  return (
    <section className="painel">
      <h2>{cidade.cidade} <span className="nota">· {cidade.pais}</span></h2>
      <p>{contagem(cidade.total)} <button onClick={onFechar} aria-label={t("painel.fechar")}>×</button></p>
      {cidade.instituicoes.map((i) => (
        <article className="inst" key={i.instituicao_id}>
          <h3>
            {i.nome}
            {i.campus_status === "pendente" && <span className="selo">{t("painel.campusPendente")}</span>}
            {i.campus_status === "padrao" && <span className="selo">{t("painel.campusPadrao")}</span>}
          </h3>
          <div><strong>{contagem(i.total)}</strong></div>
          {/* nomes (só primeiro nome, nunca inscrição): chegam apenas com MOSTRAR_NOMES=1 e fora do modo apresentação */}
          {nomes?.[i.instituicao_id] && (
            <div className="quem">
              {Object.entries(nomes[i.instituicao_id]).map(([s, lista]) => (
                <p key={s}><strong>{t("painel.semestre", { s })}</strong> ({lista.length}): {lista.join(", ")}</p>
              ))}
            </div>
          )}
          {/* privacidade: grupo com menos de k alunos não mostra curso (nem semestre, quando não há nomes) */}
          {i.total >= k && i.cursos ? (
            <>
              {!nomes?.[i.instituicao_id] && (
                <div className="sem">
                  {Object.entries(i.por_semestre).map(([s, n]) => (
                    <span key={s}>{t("painel.semestre", { s })}: {n}</span>
                  ))}
                </div>
              )}
              <strong className="nota">{t("painel.cursos")}</strong>
              <ul className="cursos">
                {Object.entries(i.cursos).map(([c, n]) => (
                  <li key={c}>{c} ({n})</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="nota">{t("painel.ocultoPrivacidade")}</p>
          )}
        </article>
      ))}
    </section>
  );
}
