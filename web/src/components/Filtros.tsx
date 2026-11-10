import { t } from "@/lib/i18n";
import type { Filtros } from "@/lib/types";

interface Props {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  opcoes: { semestres: string[]; paises: string[]; cursos: string[] };
  resultado: { alunos: number; cidades: number };
}

export default function FiltrosView({ filtros, onChange, opcoes, resultado }: Props) {
  const campo = (chave: keyof Filtros, rotulo: string, valores: string[], todos: string) => (
    <label className="campo">
      {rotulo}
      <select value={filtros[chave]} onChange={(e) => onChange({ ...filtros, [chave]: e.target.value })}>
        <option value="">{todos}</option>
        {valores.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  return (
    <section>
      <h2>{t("filtros.titulo")}</h2>
      {campo("semestre", t("filtros.semestre"), opcoes.semestres, t("filtros.todos"))}
      {campo("pais", t("filtros.pais"), opcoes.paises, t("filtros.todos"))}
      {campo("curso", t("filtros.curso"), opcoes.cursos, t("filtros.todos"))}
      <p className="nota">{t("filtros.avisoCurso")}</p>
      <p><strong>{t("filtros.resultado", { n: resultado.alunos, c: resultado.cidades })}</strong></p>
      {(filtros.semestre || filtros.pais || filtros.curso) && (
        <button onClick={() => onChange({ semestre: "", pais: "", curso: "" })}>{t("filtros.limpar")}</button>
      )}
    </section>
  );
}
