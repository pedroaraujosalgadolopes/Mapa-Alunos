import { carregar } from "@/lib/data";
import App from "@/components/App";

export const dynamic = "force-dynamic"; // o resumo muda a cada snapshot

export default function Page() {
  const { resumo, fonte } = carregar();
  return <App resumo={resumo} fonte={fonte} />;
}
