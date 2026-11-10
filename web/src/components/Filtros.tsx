import { t } from "@/lib/i18n";
import type { Filtros } from "@/lib/types";

interface Props {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  opcoes: { semestres: string[]; paises: string[] };
  resultado: { alunos: number; cidades: number };
}

export default function FiltrosView({ filtros, onChange, opcoes, resultado }: Props) {
  return (
    <section>
      <h2>{t("filtros.titulo")}</h2>
      <div className="campo">
        {t("filtros.semestre")}
        <div className="segmentos" role="group" aria-label={t("filtros.semestre")}>
          {["", ...opcoes.semestres].map((s) => (
            <button key={s || "todos"} aria-pressed={filtros.semestre === s} className={filtros.semestre === s ? "ativa" : ""}
              onClick={() => onChange({ ...filtros, semestre: s })}>
              {s || t("filtros.todos")}
            </button>
          ))}
        </div>
        <span className="nota">{t("filtros.ajudaSemestre")}</span>
      </div>
      <label className="campo">
        {t("filtros.pais")}
        <select value={filtros.pais} onChange={(e) => onChange({ ...filtros, pais: e.target.value })}>
          <option value="">{t("filtros.todos")}</option>
          {opcoes.paises.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <p><strong>{t(resultado.alunos === 1 ? "filtros.resultadoUm" : resultado.cidades === 1 ? "filtros.resultadoMisto" : "filtros.resultado",
        { n: resultado.alunos, c: resultado.cidades })}</strong></p>
      {(filtros.semestre || filtros.pais) && (
        <button onClick={() => onChange({ semestre: "", pais: "" })}>{t("filtros.limpar")}</button>
      )}
    </section>
  );
}
