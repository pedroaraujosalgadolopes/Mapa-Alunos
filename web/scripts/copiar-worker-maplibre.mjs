// O bundler do Next não resolve o worker do MapLibre 6; servimos os arquivos de public/maplibre/.
import { copyFileSync, mkdirSync } from "node:fs";

const origem = "node_modules/maplibre-gl/dist";
mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`${origem}/${f}`, `public/maplibre/${f}`);
