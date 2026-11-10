import ptBR from "../../i18n/pt-BR.json";

// Pronto para en/es: acrescente i18n/en.json e i18n/es.json e escolha o dicionário por locale.
const dicionarios: Record<string, unknown> = { "pt-BR": ptBR };

export function t(chave: string, vars: Record<string, string | number> = {}, locale = "pt-BR"): string {
  const raiz = dicionarios[locale] ?? ptBR;
  let valor: unknown = raiz;
  for (const parte of chave.split(".")) valor = (valor as Record<string, unknown> | undefined)?.[parte];
  if (typeof valor !== "string") return chave;
  return valor.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
