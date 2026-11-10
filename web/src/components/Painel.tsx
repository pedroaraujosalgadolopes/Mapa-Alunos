import { t } from "@/lib/i18n";
import type { Cidade } from "@/lib/types";

const contagem = (n: number) => (n === 1 ? t("painel.aluno") : t("painel.alunos", { n }));

export default function Painel({ cidade, k, onFechar }: { cidade: Cidade | null; k: number; onFechar: () => void }) {
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
          {/* privacidade: grupo com menos de k alunos mostra só a contagem, sem semestre nem curso */}
          {i.total >= k && i.cursos ? (
            <>
              <div className="sem">
                {Object.entries(i.por_semestre).map(([s, n]) => (
                  <span key={s}>{t("painel.semestre", { s })}: {n}</span>
                ))}
              </div>
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
