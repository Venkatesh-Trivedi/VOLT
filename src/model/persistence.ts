import { catalog, pins } from "./catalog.ts";
import type { Circuit, Part, Wire } from "./types.ts";
import { endpointKey, wireColors } from "./types.ts";
const KEY = "voltage.circuit.v1";
export function parseCircuit(text: string): Circuit {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object")
    throw new Error("This is not a Voltage circuit.");
  const c = data as Circuit;
  if (
    c.version !== 1 ||
    typeof c.name !== "string" ||
    c.name.length > 100 ||
    !Array.isArray(c.parts) ||
    !Array.isArray(c.wires) ||
    c.parts.length > 200 ||
    c.wires.length > 2000
  )
    throw new Error("Unsupported or oversized circuit file.");
  const ids = new Set<string>();
  const endpoints = new Set<string>();
  for (const p of c.parts as Part[]) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(p.id) ||
      p.id === "__proto__" ||
      ids.has(p.id) ||
      !catalog.some((m) => m.kind === p.kind) ||
      typeof p.label !== "string" ||
      p.label.length > 50 ||
      ![p.x, p.y, p.rotation, p.value].every(Number.isFinite) ||
      ![0, 90, 180, 270].includes(p.rotation) ||
      Math.abs(p.x) > 100000 ||
      Math.abs(p.y) > 100000 ||
      Math.abs(p.value) > 1e9 ||
      p.value < 0 ||
      (["resistor", "potentiometer"].includes(p.kind) &&
        !Number.isFinite(1 / p.value)) ||
      (p.wiper !== undefined &&
        (!Number.isFinite(p.wiper) || p.wiper < 0 || p.wiper > 1)) ||
      (p.meterMode !== undefined &&
        !["voltage", "current"].includes(p.meterMode)) ||
      (["resistor", "led", "diode"].includes(p.kind) && p.value === 0) ||
      typeof p.closed !== "boolean" ||
      !wireColors.includes(p.color as (typeof wireColors)[number])
    )
      throw new Error("Invalid component data.");
    ids.add(p.id);
    for (const pin of pins(p)) endpoints.add(`${p.id}:${pin.id}`);
  }
  for (const w of c.wires as Wire[]) {
    if (
      !w ||
      typeof w.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(w.id) ||
      ids.has(w.id) ||
      !w.from ||
      !w.to ||
      !endpoints.has(endpointKey(w.from)) ||
      !endpoints.has(endpointKey(w.to)) ||
      endpointKey(w.from) === endpointKey(w.to) ||
      !wireColors.includes(w.color as (typeof wireColors)[number])
    )
      throw new Error("Invalid wire or missing connection pin.");
    ids.add(w.id);
  }
  return {
    version: 1,
    name: c.name,
    parts: c.parts.map((p) => ({ ...p })),
    wires: c.wires.map((w) => ({ ...w, from: { ...w.from }, to: { ...w.to } })),
  };
}
export function saveCircuit(circuit: Circuit) {
  localStorage.setItem(KEY, JSON.stringify(circuit));
}
export function loadCircuit(): Circuit | null {
  const saved = localStorage.getItem(KEY);
  return saved ? parseCircuit(saved) : null;
}
export function formatValue(value: number, unit: string, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1e-9) return `0 ${unit}`;
  if (Math.abs(value) < 0.001)
    return `${(value * 1e6).toFixed(digits)} µ${unit}`;
  if (Math.abs(value) < 1) return `${(value * 1000).toFixed(digits)} m${unit}`;
  if (Math.abs(value) >= 1000)
    return `${(value / 1000).toFixed(digits)} k${unit}`;
  return `${value.toFixed(digits)} ${unit}`;
}
