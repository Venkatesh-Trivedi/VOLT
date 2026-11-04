import { breadboardGroup, meta, pins } from "./catalog.ts";
import { endpointKey } from "./types.ts";
import type { Circuit, Diagnostic, Part, Simulation } from "./types.ts";

class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) this.parent.set(x, this.find(p));
    return this.parent.get(x)!;
  }
  join(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b));
  }
}
export function buildNetlist(circuit: Circuit) {
  const uf = new UnionFind();
  for (const p of circuit.parts) {
    const groups = new Map<string, string>();
    for (const pin of pins(p)) {
      const key = `${p.id}:${pin.id}`;
      uf.find(key);
      if (p.kind === "breadboard") {
        const group = breadboardGroup(pin.id);
        if (groups.has(group)) uf.join(key, groups.get(group)!);
        else groups.set(group, key);
      }
    }
    if (["switch", "pushbutton"].includes(p.kind) && p.closed)
      uf.join(`${p.id}:a`, `${p.id}:b`);
  }
  for (const wire of circuit.wires)
    uf.join(endpointKey(wire.from), endpointKey(wire.to));
  const grounds = circuit.parts.filter((p) => p.kind === "ground");
  for (const g of grounds.slice(1)) uf.join(`${grounds[0].id}:g`, `${g.id}:g`);
  return Object.fromEntries(
    [...uf.parent.keys()].map((key) => [key, uf.find(key)]),
  );
}
function linearSolve(matrix: number[][], rhs: number[]): number[] | null {
  const a = matrix.map((row, i) => [...row, rhs[i]]),
    n = rhs.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-15) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const value = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= value;
    for (let row = 0; row < n; row++)
      if (row !== col) {
        const f = a[row][col];
        if (f === 0) continue;
        for (let j = col; j <= n; j++) a[row][j] -= f * a[col][j];
      }
  }
  const solution = a.map((row) => row[n]);
  return solution.every(Number.isFinite) ? solution : null;
}
export function simulate(circuit: Circuit): Simulation {
  const result: Simulation = {
    valid: true,
    readings: {},
    pinVoltages: {},
    diagnostics: [],
    nodes: 0,
    sourcePower: 0,
  };
  const diagnostic = (level: Diagnostic["level"], message: string) =>
    result.diagnostics.push({ level, message });
  const net = buildNetlist(circuit);
  const branches = circuit.parts.filter((p) =>
    ["resistor", "led", "diode", "battery", "supply"].includes(p.kind),
  );
  const terminals = (p: Part) =>
    pins(p)
      .slice(0, 2)
      .map((pin) => net[`${p.id}:${pin.id}`]);
  const sources = branches.filter(
    (p) => p.kind === "battery" || p.kind === "supply",
  );
  const diodes = branches.filter((p) => ["led", "diode"].includes(p.kind));
  const unsupported = circuit.parts.filter((p) => !meta(p.kind).supported);
  for (const p of unsupported)
    diagnostic(
      "warning",
      `${p.label}: ${meta(p.kind).name} has no electrical model; its pins are open.`,
    );
  for (const p of branches)
    if (
      !Number.isFinite(p.value) ||
      (p.kind === "resistor" && (p.value <= 0 || !Number.isFinite(1 / p.value))) ||
      (["led", "diode"].includes(p.kind) && p.value <= 0)
    )
      diagnostic("error", `${p.label}: invalid component value.`);
  for (const s of sources) {
    const [a, b] = terminals(s);
    if (a === b)
      diagnostic(
        "error",
        `${s.label}: short circuit across an ideal voltage source. Open the path before running.`,
      );
  }
  if (result.diagnostics.some((d) => d.level === "error"))
    return { ...result, valid: false };
  if (!sources.length) {
    diagnostic("info", "Add a battery or DC supply to power this circuit.");
    return result;
  }
  // Each isolated electrical island needs its own reference; unused breadboard nodes do not enter the matrix.
  const islands = new UnionFind();
  const used = new Set<string>();
  for (const p of branches) {
    const [a, b] = terminals(p);
    used.add(a);
    used.add(b);
    islands.join(a, b);
  }
  const refs = new Map<string, string>();
  for (const p of circuit.parts.filter((p) => p.kind === "ground")) {
    const n = net[`${p.id}:g`];
    if (used.has(n)) refs.set(islands.find(n), n);
  }
  for (const s of sources) {
    const n = terminals(s)[1];
    if (!refs.has(islands.find(n))) refs.set(islands.find(n), n);
  }
  for (const n of used)
    if (!refs.has(islands.find(n))) refs.set(islands.find(n), n);
  const referenceNodes = new Set(refs.values());
  const nodes = [...used].filter((n) => !referenceNodes.has(n));
  const index = new Map(nodes.map((node, i) => [node, i]));
  result.nodes = used.size;
  if (!circuit.parts.some((p) => p.kind === "ground"))
    diagnostic(
      "info",
      "Source negative terminals are the automatic 0 V references.",
    );
  if (refs.size > 1)
    diagnostic(
      "warning",
      `${refs.size} disconnected electrical islands; voltages use a separate reference per island.`,
    );
  const ledStates = new Map(diodes.map((p) => [p.id, false]));
  let solution: number[] | null = null;
  let converged = false;
  for (let iteration = 0; iteration < 32; iteration++) {
    const size = nodes.length + sources.length;
    const matrix = Array.from(
      { length: size },
      () => Array(size).fill(0) as number[],
    );
    const rhs = Array(size).fill(0) as number[];
    const add = (
      a: number | undefined,
      b: number | undefined,
      value: number,
    ) => {
      if (a !== undefined && b !== undefined) matrix[a][b] += value;
    };
    for (const p of branches) {
      const [an, bn] = terminals(p),
        a = index.get(an),
        b = index.get(bn);
      if (p.kind === "resistor" || ["led", "diode"].includes(p.kind)) {
        // Off-state conductance stabilizes floating diode nodes; it is not a physical leakage model.
        const on = ledStates.get(p.id);
        const g = p.kind === "resistor" ? 1 / p.value : on ? 0.1 : 1e-12;
        add(a, a, g);
        add(b, b, g);
        add(a, b, -g);
        add(b, a, -g);
        if (["led", "diode"].includes(p.kind) && on) {
          if (a !== undefined) rhs[a] += g * p.value;
          if (b !== undefined) rhs[b] -= g * p.value;
        }
      } else {
        const k = nodes.length + sources.indexOf(p);
        add(a, k, 1);
        add(b, k, -1);
        add(k, a, 1);
        add(k, b, -1);
        rhs[k] = p.value;
      }
    }
    solution = linearSolve(matrix, rhs);
    if (!solution) {
      diagnostic(
        "error",
        "Conflicting or redundant ideal voltage sources. Check source polarity and parallel source connections.",
      );
      return { ...result, valid: false };
    }
    const volts = (n: string) => (index.has(n) ? solution![index.get(n)!] : 0);
    let changed = false;
    for (const led of diodes) {
      const [a, b] = terminals(led);
      const next = volts(a) - volts(b) > led.value + 1e-8;
      if (next !== ledStates.get(led.id)) {
        changed = true;
        ledStates.set(led.id, next);
      }
    }
    if (!changed) {
      converged = true;
      break;
    }
  }
  if (!converged || !solution) {
    diagnostic(
      "error",
      "LED operating point did not converge. Simplify the circuit and retry.",
    );
    return { ...result, valid: false };
  }
  const volts = (n: string) => (index.has(n) ? solution![index.get(n)!] : 0);
  for (const [pin, n] of Object.entries(net))
    if (used.has(n)) result.pinVoltages[pin] = volts(n);
  for (const p of branches) {
    const [a, b] = terminals(p);
    const voltage = volts(a) - volts(b);
    let current = 0;
    if (p.kind === "resistor") current = voltage / p.value;
    else if (["led", "diode"].includes(p.kind))
      current = ledStates.get(p.id) ? Math.max(0, (voltage - p.value) / 10) : 0;
    else current = solution[nodes.length + sources.indexOf(p)];
    result.readings[p.id] = {
      voltage,
      current,
      power: voltage * current,
      ...(["led", "diode"].includes(p.kind) ? { lit: current > 0.0001 } : {}),
    };
    if (p.kind === "led" && current > 0.025)
      diagnostic(
        "warning",
        `${p.label}: LED current is ${(current * 1000).toFixed(1)} mA. Add or increase the series resistor (typical target ≤ 20 mA).`,
      );
    if (p.kind === "led" && current < 0.0001)
      diagnostic(
        "warning",
        voltage < -1e-6
          ? `${p.label}: LED is reverse-biased (${voltage.toFixed(2)} V anode to cathode). Reverse its connections.`
          : `${p.label}: forward current is below the illumination threshold; check the open path and the ${p.value} V forward-voltage requirement.`,
      );
    if (p.kind === "resistor" && voltage * current > 0.25)
      diagnostic(
        "warning",
        `${p.label}: ${(voltage * current).toFixed(2)} W exceeds a typical ¼ W resistor rating.`,
      );
    if (p.kind === "battery" || p.kind === "supply")
      result.sourcePower += Math.max(0, -voltage * current);
  }
  for (const p of circuit.parts.filter((p) =>
    ["switch", "pushbutton"].includes(p.kind),
  )) {
    const [a, b] = terminals(p);
    const measurable =
      used.has(a) && used.has(b) && islands.find(a) === islands.find(b);
    // shortcut: closed contacts are merged nodes; use a zero-volt MNA branch if contact current is needed.
    result.readings[p.id] = {
      voltage: measurable ? volts(a) - volts(b) : NaN,
      current: p.closed ? NaN : 0,
      power: 0,
    };
  }
  for (const p of circuit.parts.filter((p) => p.kind === "multimeter")) {
    const [a, b] = terminals(p);
    if (used.has(a) && used.has(b) && islands.find(a) === islands.find(b))
      result.readings[p.id] = {
        voltage: volts(a) - volts(b),
        current: 0,
        power: 0,
      };
    else
      diagnostic(
        "warning",
        p.label + ": connect both probes within the same electrical island.",
      );
  }
  if (sources.every((p) => Math.abs(result.readings[p.id].current) < 1e-8))
    diagnostic(
      "warning",
      "Open circuit: no current flows from the sources. Check connections, switches, and LED polarity.",
    );
  if (diodes.length)
    diagnostic(
      "info",
      "Diode/LED model: configured forward threshold + 10 Ω dynamic resistance; reverse leakage, breakdown, and heat are not modeled.",
    );
  return result;
}
