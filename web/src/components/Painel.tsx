import { t } from "@/lib/i18n";
import { fmtDuracao } from "@/lib/tempos";
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

function Instituicao({ i, nomes, semestres, k, semestre }: { i: Instituicao; nomes: Nomes | null; semestres: string[]; k: number; semestre: string }) {
  const gente = nomes?.[i.instituicao_id];
  const total = semestre ? (i.por_semestre[semestre] ?? 0) : i.total;
  return (
    <article className="inst">
      <h3>
        {i.nome}
        {i.campus_status === "pendente" && <span className="selo">{t("painel.campusPendente")}</span>}
        {i.campus_status === "padrao" && <span className="selo">{t("painel.campusPadrao")}</span>}
      </h3>
      {gente ? (
        Object.entries(gente).filter(([s]) => !semestre || s === semestre).map(([s, pessoas]) => (
          <section key={s} className="grupo-sem">
            <h4 style={{ "--c": corSemestre(semestres, s) } as React.CSSProperties}>
              <span className="badge-sem">{s}</span> <span className="nota">{contagem(pessoas.length)}</span>
            </h4>
            <ul className="alunos">{pessoas.map((p, n) => <CartaoAluno key={`${p.nome}-${n}`} p={p} />)}</ul>
          </section>
        ))
      ) : (
        <>
          <div><strong>{contagem(total)}</strong></div>
          {/* sem nomes (visitante/modo apresentação): grupo com menos de k alunos não mostra semestre nem curso */}
          {!semestre && i.total >= k && i.cursos ? (
            <>
              <div className="sem">
                {Object.entries(i.por_semestre).map(([s, n]) => (
                  <span key={s} className="chip" style={{ "--c": corSemestre(semestres, s) } as React.CSSProperties}>{t("painel.semestreN", { n, s })}</span>
                ))}
              </div>
              <strong className="nota">{t("painel.cursos")}</strong>
              <ul className="cursos">{Object.entries(i.cursos).map(([c, n]) => <li key={c}>{c} ({n})</li>)}</ul>
            </>
          ) : !semestre ? (
            <p className="nota">{t("painel.ocultoPrivacidade")}</p>
          ) : null}
        </>
      )}
    </article>
  );
}

export interface Vizinho { id: string; nome: string; pais: string; iso2: string | null; n: number; min: number; modo: "terra" | "voo" }

export default function Painel({ cidade, k, nomes, semestres, semestre, vizinhos, raioH, onFechar, onSelect }: {
  cidade: Cidade | null; k: number; nomes: Nomes | null; semestres: string[]; semestre: string; vizinhos: Vizinho[] | null; raioH: number;
  onFechar: () => void; onSelect: (id: string) => void }) {
  if (!cidade) return <p className="nota">{t("painel.vazio")}</p>;
  const porSem: Record<string, number> = {};
  for (const i of cidade.instituicoes) for (const [s, n] of Object.entries(i.por_semestre)) if (!semestre || s === semestre) porSem[s] = (porSem[s] ?? 0) + n;
  const totalCidade = Object.values(porSem).reduce((a, b) => a + b, 0);
  const instituicoes = cidade.instituicoes.filter((i) => !semestre || (i.por_semestre[semestre] ?? 0) > 0);
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
        <span className="chip forte">{contagem(totalCidade)}</span>
        {Object.entries(porSem).sort().map(([s, n]) => (
          <span key={s} className="chip" style={{ "--c": corSemestre(semestres, s) } as React.CSSProperties}>{t("painel.semestreN", { n, s })}</span>
        ))}
      </div>
      {vizinhos && (
        <section className="vizinhos">
          <h3>{t("vizinhos.titulo")} <span className="nota">· {raioH ? t("vizinhos.dentroDoRaio", { h: raioH }) : t("vizinhos.maisProximas")}{semestre && <> {t("vizinhos.noSemestre", { s: semestre })}</>}</span></h3>
          {vizinhos.length === 0 ? <p className="nota">{t("vizinhos.nenhuma")}</p> : (
            <ul>
              {vizinhos.map((v) => (
                <li key={v.id}>
                  <button onClick={() => onSelect(v.id)}>
                    <span aria-hidden>{bandeira(v.iso2)}</span> <strong>{v.nome}</strong>
                    <span className="nota"> {v.pais} · {contagem(v.n)}</span>
                    <span className="tempo">{v.modo === "voo" && "✈ "}~{fmtDuracao(v.min)}{v.modo === "voo" && <small> {t("vizinhos.estimado")}</small>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="nota">{t("raio.notaTempos")}</p>
        </section>
      )}
      {totalCidade === 0 && <p className="nota">{t("painel.ninguemNoSemestre", { s: semestre })}</p>}
      {instituicoes.map((i) => <Instituicao key={i.instituicao_id} i={i} nomes={nomes} semestres={semestres} k={k} semestre={semestre} />)}
    </section>
  );
}
