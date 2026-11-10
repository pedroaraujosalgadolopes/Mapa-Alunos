import { carregar } from "@/lib/data";
import App from "@/components/App";

export const dynamic = "force-dynamic"; // o resumo muda a cada snapshot

// ?apresentacao=1 : modo SRI, só dados agregados (sem nomes)
export default async function Page({ searchParams }: { searchParams: Promise<{ apresentacao?: string }> }) {
  const apresentacao = (await searchParams).apresentacao === "1";
  const { resumo, fonte, nomes, tempos } = carregar({ apresentacao });
  return <App resumo={resumo} fonte={fonte} nomes={nomes} tempos={tempos} apresentacao={apresentacao} />;
}
