export interface Instituicao {
  instituicao_id: string;
  nome: string;
  campus_status: "unico" | "padrao" | "pendente";
  total: number;
  por_semestre: Record<string, number>;
  cursos: Record<string, number> | null; // null quando o grupo tem menos de 3 alunos
  areas?: Record<string, Record<string, number>> | null; // {área: {semestre: n}}; null com menos de 3 alunos
}

export interface Cidade {
  cidade_id: string;
  cidade: string | null;
  pais: string | null;
  iso2: string | null;
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
  curso_area?: Record<string, string>; // curso → área de interesse
  cidades: Cidade[];
}

export interface Filtros {
  semestre: string;
  pais: string;
  area: string; // "" = todas as áreas
}

export interface Pessoa {
  nome: string; // só o primeiro nome, nunca inscrição
  curso: string;
  area?: string; // área de interesse do curso (data/reference/areas.csv)
  campus_origem: string; // campus da UFF de origem (ex.: Volta Redonda); vazio = Niterói
}

/** {instituicao_id: {semestre: [Pessoa]}}; só chega ao cliente se MOSTRAR_NOMES=1 e fora do modo apresentação. */
export type Nomes = Record<string, Record<string, Pessoa[]>>;
