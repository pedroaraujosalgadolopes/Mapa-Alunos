import fs from "node:fs";
import path from "node:path";
import type { Nomes, Resumo } from "./types";

// Lê SOMENTE data/public/resumo.json (ou o sintético) e data/reference/cidades.csv. Nunca data/private.
const DATA = process.env.DATA_DIR ?? path.resolve(process.cwd(), "..", "data");

function csv(arquivo: string): Record<string, string>[] {
  const [cab, ...linhas] = fs.readFileSync(arquivo, "utf8").trim().split(/\r?\n/);
  const cols = cab.split(",");
  return linhas.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

/** Nomes (primeiro nome, nunca inscrição): só com MOSTRAR_NOMES=1 e fora do modo apresentação. */
export function carregar(opts: { apresentacao?: boolean } = {}): { resumo: Resumo; fonte: "real" | "sintetico"; nomes: Nomes | null } {
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
  const permitido = process.env.MOSTRAR_NOMES === "1" && !opts.apresentacao;
  const arqNomes = path.join(DATA, usarSintetico ? "synthetic" : "", "public", "nomes.json");
  const nomes: Nomes | null = permitido && fs.existsSync(arqNomes) ? JSON.parse(fs.readFileSync(arqNomes, "utf8")) : null;
  return { resumo, fonte: usarSintetico ? "sintetico" : "real", nomes };
}
