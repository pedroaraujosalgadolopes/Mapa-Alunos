export interface Instituicao {
  instituicao_id: string;
  nome: string;
  campus_status: "unico" | "padrao" | "pendente";
  total: number;
  por_semestre: Record<string, number>;
  cursos: Record<string, number> | null; // null quando o grupo tem menos de 3 alunos
  cursos_por_semestre: Record<string, Record<string, number>> | null;
}

export interface Cidade {
  cidade_id: string;
  cidade: string | null;
  pais: string | null;
  regiao_id: string | null;
  regiao_ativa: boolean;
  lat: number | null;
  lon: number | null;
  campus_pendente: boolean;
  total: number;
  instituicoes: Instituicao[];
}

export interface Resumo {
  snapshot: string;
  edital: string;
  rotulo: string;
  total: number;
  k_min: number;
  cidades: Cidade[];
}

export interface Filtros {
  semestre: string;
  pais: string;
  curso: string;
}

/** {instituicao_id: {semestre: [primeiro nome]}}; só chega ao cliente se MOSTRAR_NOMES=1 e fora do modo apresentação. */
export type Nomes = Record<string, Record<string, string[]>>;
