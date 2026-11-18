import { t } from "@/lib/i18n";
import type { Resumo } from "@/lib/types";

export default function Faixa({ resumo, fonte, apresentacao, temposSimulados }: {
  resumo: Resumo; fonte: "real" | "sintetico"; apresentacao: boolean; temposSimulados: boolean }) {
  const [, mes, dia] = resumo.snapshot.split("_");
  return (
    <header className="faixa" role="status">
      <strong>
        {fonte === "sintetico"
          ? t("banner.sintetico")
          : t(resumo.rotulo === "final" ? "banner.final" : "banner.preliminar", { edital: resumo.edital, data: `${dia}/${mes}` })}
      </strong>
      {temposSimulados && fonte !== "sintetico" && <strong>{t("banner.temposSimulados")}</strong>}
      <span className="snap">{apresentacao && <>{t("banner.apresentacao")} · </>}{t("banner.snapshot", { snapshot: resumo.snapshot })}</span>
    </header>
  );
}
