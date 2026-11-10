import tokens from "../../design/tokens.json";

export { tokens };

/** Achata design/tokens.json em variáveis CSS (--color-bg, --space-2, ...). */
export function cssVars(): string {
  const linhas: string[] = [];
  for (const [grupo, valores] of Object.entries(tokens)) {
    if (typeof valores !== "object") continue;
    for (const [k, v] of Object.entries(valores as Record<string, string | number>)) {
      linhas.push(`--${grupo}-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v};`);
    }
  }
  return `:root{${linhas.join("")}}`;
}
