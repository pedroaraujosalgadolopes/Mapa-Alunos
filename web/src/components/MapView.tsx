"use client";

import * as maplibregl from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { useEffect, useMemo, useRef } from "react";
import { tokens } from "@/lib/tokens";

export interface No {
  id: string;
  nome: string;
  pais: string;
  n: number;
  lat: number;
  lon: number;
  tipo: "padrao" | "pendente" | "fora";
}

const FONTE = "nos";
const estilo: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const { nodeMinRadius: rMin, nodeMaxRadius: rMax } = tokens.map;
const raio = ["interpolate", ["linear"], ["get", "n"], 1, rMin, 5, rMin + 5, 15, rMin + 13, 40, rMax] as maplibregl.ExpressionSpecification;
const cor = [
  "match", ["get", "tipo"],
  "pendente", tokens.color.nodePendente,
  "fora", tokens.color.nodeFora,
  tokens.color.nodeDefault,
] as maplibregl.ExpressionSpecification;

export default function MapView(props: { nos: No[]; selecionada: string | null; onSelect: (id: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const pronto = useRef(false);
  const onSelect = useRef(props.onSelect);
  onSelect.current = props.onSelect;

  const geo = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: props.nos.map((n) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [n.lon, n.lat] },
        properties: { id: n.id, nome: n.nome, pais: n.pais, n: n.n, tipo: n.tipo },
      })),
    }),
    [props.nos],
  );
  const geoRef = useRef(geo);
  geoRef.current = geo;

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: estilo, center: [12, 49], zoom: 3.4, attributionControl: { compact: true } });
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    m.on("load", () => {
      m.addSource(FONTE, { type: "geojson", data: geoRef.current });
      m.addLayer({ id: "nos", type: "circle", source: FONTE, paint: {
        "circle-radius": raio, "circle-color": cor, "circle-opacity": 0.82,
        "circle-stroke-color": tokens.color.nodeStroke, "circle-stroke-width": 1.5 } });
      m.addLayer({ id: "sel", type: "circle", source: FONTE, filter: ["==", ["get", "id"], ""], paint: {
        "circle-radius": ["+", raio, 4] as maplibregl.ExpressionSpecification, "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": tokens.color.nodeSelecionado, "circle-stroke-width": 3 } });
      m.on("click", "nos", (e) => onSelect.current(String(e.features?.[0]?.properties?.id ?? "")));
      m.on("mouseenter", "nos", (e) => {
        m.getCanvas().style.cursor = "pointer";
        const p = e.features![0].properties!;
        popup.setLngLat((e.features![0].geometry as Point).coordinates as [number, number])
          .setText(`${p.nome} (${p.n})`).addTo(m);
      });
      m.on("mouseleave", "nos", () => { m.getCanvas().style.cursor = ""; popup.remove(); });
      pronto.current = true;
      m.getSource(FONTE) && (m.getSource(FONTE) as maplibregl.GeoJSONSource).setData(geoRef.current);
    });
    return () => { pronto.current = false; m.remove(); };
  }, []);

  useEffect(() => {
    if (pronto.current) (mapa.current!.getSource(FONTE) as maplibregl.GeoJSONSource).setData(geo);
  }, [geo]);

  useEffect(() => {
    if (pronto.current) mapa.current!.setFilter("sel", ["==", ["get", "id"], props.selecionada ?? ""]);
  }, [props.selecionada, geo]);

  return <div ref={el} role="application" aria-label="Mapa" />;
}
