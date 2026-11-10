import { t } from "@/lib/i18n";
import { tokens } from "@/lib/tokens";
import type { Cidade, Instituicao, Nomes, Pessoa } from "@/lib/types";

const contagem = (n: number) => (n === 1 ? t("painel.aluno") : t("painel.alunos", { n }));
const bandeira = (iso2: string | null) =>
  iso2 && iso2.length === 2 ? String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";

// cor estável por nome (avatar) e por semestre (posição na lista ordenada); paletas vêm de design/tokens.json
const corAvatar = (nome: string) => {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return tokens.color.avatarPalette[h % tokens.color.avatarPalette.length];
};
const corSemestre = (semestres: string[], s: string) =>
  tokens.color.semestrePalette[semestres.indexOf(s) % tokens.color.semestrePalette.length];

function CartaoAluno({ p }: { p: Pessoa }) {
  return (
    <li className="aluno">
      <span className="avatar" style={{ background: corAvatar(p.nome) }} aria-hidden>{p.nome.charAt(0).toUpperCase()}</span>
      <span className="aluno-txt">
        <strong>{p.nome}</strong>
        <span>{p.curso}</span>
        <span className="origem">{p.campus_origem ? t("painel.uffCampus", { campus: p.campus_origem }) : t("painel.uffNiteroi")}</span>
      </span>
    </li>
  );
}

function Instituicao({ i, nomes, semestres, k }: { i: Instituicao; nomes: Nomes | null; semestres: string[]; k: number }) {
  const gente = nomes?.[i.instituicao_id];
  return (
    <article className="inst">
      <h3>
        {i.nome}
        {i.campus_status === "pendente" && <span className="selo">{t("painel.campusPendente")}</span>}
        {i.campus_status === "padrao" && <span className="selo">{t("painel.campusPadrao")}</span>}
      </h3>
      {gente ? (
        Object.entries(gente).map(([s, pessoas]) => (
          <section key={s} className="grupo-sem">
            <h4 style={{ "--c": corSemestre(semestres, s) } as React.CSSProperties}>
              <span className="badge-sem">{s}</span> <span className="nota">{contagem(pessoas.length)}</span>
            </h4>
            <ul className="alunos">{pessoas.map((p, n) => <CartaoAluno key={`${p.nome}-${n}`} p={p} />)}</ul>
          </section>
        ))
      ) : (
        <>
          <div><strong>{contagem(i.total)}</strong></div>
          {/* sem nomes (visitante/modo apresentação): grupo com menos de k alunos não mostra semestre nem curso */}
          {i.total >= k && i.cursos ? (
            <>
              <div className="sem">
                {Object.entries(i.por_semestre).map(([s, n]) => (
                  <span key={s} className="chip" style={{ "--c": corSemestre(semestres, s) } as React.CSSProperties}>{t("painel.semestreN", { n, s })}</span>
                ))}
              </div>
              <strong className="nota">{t("painel.cursos")}</strong>
              <ul className="cursos">{Object.entries(i.cursos).map(([c, n]) => <li key={c}>{c} ({n})</li>)}</ul>
            </>
          ) : (
            <p className="nota">{t("painel.ocultoPrivacidade")}</p>
          )}
        </>
      )}
    </article>
  );
}

export default function Painel({ cidade, k, nomes, semestres, onFechar }: {
  cidade: Cidade | null; k: number; nomes: Nomes | null; semestres: string[]; onFechar: () => void }) {
  if (!cidade) return <p className="nota">{t("painel.vazio")}</p>;
  const porSem: Record<string, number> = {};
  for (const i of cidade.instituicoes) for (const [s, n] of Object.entries(i.por_semestre)) porSem[s] = (porSem[s] ?? 0) + n;
  return (
    <section className="painel">
      <header className="cidade-cab">
        <div>
          <h2><span aria-hidden>{bandeira(cidade.iso2)}</span> {cidade.cidade}</h2>
          <span className="nota">{cidade.pais}</span>
        </div>
        <button onClick={onFechar} aria-label={t("painel.fechar")}>×</button>
      </header>
      <div className="chips">
        <span className="chip forte">{contagem(cidade.total)}</span>
        {Object.entries(porSem).sort().map(([s, n]) => (
          <span key={s} className="chip" style={{ "--c": corSemestre(semestres, s) } as React.CSSProperties}>{t("painel.semestreN", { n, s })}</span>
        ))}
      </div>
      {cidade.instituicoes.map((i) => <Instituicao key={i.instituicao_id} i={i} nomes={nomes} semestres={semestres} k={k} />)}
    </section>
  );
}
