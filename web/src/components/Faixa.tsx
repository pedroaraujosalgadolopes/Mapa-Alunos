import { t } from "@/lib/i18n";
import type { Resumo } from "@/lib/types";

export default function Faixa({ resumo, fonte }: { resumo: Resumo; fonte: "real" | "sintetico" }) {
  const [, mes, dia] = resumo.snapshot.split("_");
  return (
    <header className="faixa" role="status">
      <strong>
        {fonte === "sintetico"
          ? t("banner.sintetico")
          : t("banner.preliminar", { edital: resumo.edital, data: `${dia}/${mes}` })}
      </strong>
      <span className="snap">{t("banner.snapshot", { snapshot: resumo.snapshot })}</span>
    </header>
  );
}
