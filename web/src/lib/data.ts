import fs from "node:fs";
import path from "node:path";
import type { Resumo } from "./types";

// Lê SOMENTE data/public/resumo.json (ou o sintético) e data/reference/cidades.csv. Nunca data/private.
const DATA = process.env.DATA_DIR ?? path.resolve(process.cwd(), "..", "data");

function csv(arquivo: string): Record<string, string>[] {
  const [cab, ...linhas] = fs.readFileSync(arquivo, "utf8").trim().split(/\r?\n/);
  const cols = cab.split(",");
  return linhas.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

export function carregar(): { resumo: Resumo; fonte: "real" | "sintetico" } {
  const real = path.join(DATA, "public", "resumo.json");
  const sint = path.join(DATA, "synthetic", "public", "resumo.json");
  const usarSintetico = process.env.DATA_SOURCE === "synthetic" || !fs.existsSync(real);
  const resumo: Resumo = JSON.parse(fs.readFileSync(usarSintetico ? sint : real, "utf8"));
  // coordenadas e região vêm da tabela de referência (fonte única; editável sem refazer o snapshot)
  const ref = new Map(csv(path.join(DATA, "reference", "cidades.csv")).map((c) => [c.cidade_id, c]));
  for (const c of resumo.cidades) {
    const r = ref.get(c.cidade_id);
    if (r) {
      c.lat = Number(r.lat);
      c.lon = Number(r.lon);
    }
  }
  resumo.cidades = resumo.cidades.filter((c) => c.lat !== null && c.lon !== null); // "pendente" sem cidade fica fora do mapa
  return { resumo, fonte: usarSintetico ? "sintetico" : "real" };
}
