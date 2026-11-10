import fs from "node:fs";
import path from "node:path";
import { type LinhaTempo, type Tempos, montarTempos } from "./tempos";
import type { Nomes, Resumo } from "./types";

// Lê SOMENTE data/public/resumo.json (ou o sintético), data/reference/cidades.csv e a tabela de tempos. Nunca data/private.
const DATA = process.env.DATA_DIR ?? path.resolve(process.cwd(), "..", "data");

/** CSV simples com suporte a aspas. */
function csv(arquivo: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  const txt = fs.readFileSync(arquivo, "utf8");
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((v) => v !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ""])));
}

/** Nomes (primeiro nome, nunca inscrição): só com MOSTRAR_NOMES=1 e fora do modo apresentação. */
export function carregar(opts: { apresentacao?: boolean } = {}): {
  resumo: Resumo; fonte: "real" | "sintetico"; nomes: Nomes | null; tempos: Tempos | null } {
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
  // tempos: o dado real só vem da consulta real; o simulado existe apenas no dataset sintético
  const dirTempos = usarSintetico ? path.join(DATA, "synthetic") : path.join(DATA, "reference", "tempos");
  const lerTempos = (nome: string) => {
    const arq = path.join(dirTempos, nome);
    return fs.existsSync(arq) ? (csv(arq) as unknown as LinhaTempo[]) : [];
  };
  const tempos = montarTempos([...lerTempos("tempos.csv"), ...lerTempos("voos_estimados.csv")]);
  return { resumo, fonte: usarSintetico ? "sintetico" : "real", nomes, tempos };
}
