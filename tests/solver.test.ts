import assert from "node:assert/strict";
import test from "node:test";
import { createPart, starterCircuit } from "../src/model/catalog.ts";
import { buildNetlist, simulate } from "../src/model/solver.ts";
import {
  loadCircuit,
  parseCircuit,
  saveCircuit,
} from "../src/model/persistence.ts";
import type { Circuit, Kind, Part, Wire } from "../src/model/types.ts";

const part = (kind: Kind, id: string, value?: number): Part => ({
  ...createPart(kind, 0, 0),
  id,
  label: id,
  ...(value === undefined ? {} : { value }),
});
const wire = (a: string, ap: string, b: string, bp: string): Wire => ({
  id: crypto.randomUUID(),
  from: { part: a, pin: ap },
  to: { part: b, pin: bp },
  color: "coral",
});
const circuit = (parts: Part[], wires: Wire[]): Circuit => ({
  version: 1,
  name: "Numerical test",
  parts,
  wires,
});
const close = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
function resistorLoop() {
  return circuit(
    [part("battery", "B", 10), part("resistor", "R", 1000)],
    [wire("B", "p", "R", "a"), wire("R", "b", "B", "n")],
  );
}

test("battery and resistor satisfy Ohm's law, power, and source balance", () => {
  const s = simulate(resistorLoop());
  assert.equal(s.valid, true);
  close(s.readings.R.current, 0.01);
  close(s.readings.R.voltage, 10);
  close(s.readings.R.power, 0.1);
  close(s.readings.B.current, -0.01);
  close(s.sourcePower, 0.1);
});

test("series resistor voltage drops sum to source voltage", () => {
  const c = circuit(
    [
      part("battery", "B", 12),
      part("resistor", "R1", 1000),
      part("resistor", "R2", 2000),
    ],
    [
      wire("B", "p", "R1", "a"),
      wire("R1", "b", "R2", "a"),
      wire("R2", "b", "B", "n"),
    ],
  );
  const s = simulate(c);
  assert.equal(s.valid, true);
  close(s.readings.R1.current, 0.004);
  close(s.readings.R1.voltage, 4);
  close(s.readings.R2.voltage, 8);
  close(s.readings.R1.voltage + s.readings.R2.voltage, 12);
});

test("parallel branch currents sum to source current", () => {
  const c = circuit(
    [
      part("battery", "B", 12),
      part("resistor", "R1", 1000),
      part("resistor", "R2", 2000),
    ],
    [
      wire("B", "p", "R1", "a"),
      wire("B", "p", "R2", "a"),
      wire("R1", "b", "B", "n"),
      wire("R2", "b", "B", "n"),
    ],
  );
  const s = simulate(c);
  close(s.readings.R1.current, 0.012);
  close(s.readings.R2.current, 0.006);
  close(s.readings.R1.current + s.readings.R2.current, -s.readings.B.current);
});

test("open ideal switch interrupts a branch and reports zero contact current", () => {
  const c = resistorLoop();
  c.parts.push(part("switch", "S"));
  c.wires[1] = wire("R", "b", "S", "a");
  c.wires.push(wire("S", "b", "B", "n"));
  const s = simulate(c);
  close(s.readings.R.current, 0);
  close(s.readings.S.current, 0);
  assert.ok(s.diagnostics.some((d) => /Open circuit/.test(d.message)));
  c.parts.find((p) => p.id === "S")!.closed = true;
  close(simulate(c).readings.R.current, 0.01);
});

test("direct source short is rejected without invented readings", () => {
  const c = resistorLoop();
  c.wires.push(wire("B", "p", "B", "n"));
  const s = simulate(c);
  assert.equal(s.valid, false);
  assert.ok(
    s.diagnostics.some(
      (d) => d.level === "error" && /short circuit/.test(d.message),
    ),
  );
  assert.deepEqual(s.readings, {});
});

test("reversed LED remains unlit and explains its reverse bias", () => {
  const c = starterCircuit();
  for (const w of c.wires)
    for (const e of [w.from, w.to])
      if (e.part === "led") e.pin = e.pin === "a" ? "b" : "a";
  const s = simulate(c);
  assert.equal(s.valid, true);
  assert.equal(s.readings.led.lit, false);
  close(s.readings.led.current, 0);
  assert.ok(s.diagnostics.some((d) => /reverse-biased/.test(d.message)));
});

test("forward LED operating point includes the configured threshold and dynamic resistance", () => {
  const s = simulate(starterCircuit());
  assert.equal(s.readings.led.lit, true);
  close(s.readings.led.current, 7 / 340);
  close(s.readings.resistor.voltage + s.readings.led.voltage, 9);
});

test("breadboard five-hole strips share a node and adjacent columns remain separate", () => {
  const c = circuit([part("breadboard", "BB")], []),
    n = buildNetlist(c);
  assert.equal(n["BB:a4"], n["BB:e4"]);
  assert.equal(n["BB:f4"], n["BB:j4"]);
  assert.notEqual(n["BB:a4"], n["BB:a5"]);
});

test("breadboard center gap separates terminal strips", () => {
  const n = buildNetlist(circuit([part("breadboard", "BB")], []));
  assert.notEqual(n["BB:e4"], n["BB:f4"]);
});

test("breadboard power rails are continuous and independent", () => {
  const n = buildNetlist(circuit([part("breadboard", "BB")], []));
  assert.equal(n["BB:tp1"], n["BB:tp25"]);
  assert.notEqual(n["BB:tp1"], n["BB:tn1"]);
  assert.notEqual(n["BB:tp1"], n["BB:bp1"]);
});

test("deleting a wire changes topology and interrupts source current", () => {
  const c = resistorLoop();
  close(simulate(c).readings.R.current, 0.01);
  c.wires.pop();
  close(simulate(c).readings.R.current, 0);
});

test("browser save/load restores the actual circuit and pin connections", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      setItem: (key: string, value: string) => store.set(key, value),
      getItem: (key: string) => store.get(key) ?? null,
    },
  });
  try {
    const c = starterCircuit();
    saveCircuit(c);
    const restored = loadCircuit();
    assert.deepEqual(restored, c);
    assert.deepEqual(buildNetlist(restored!), buildNetlist(c));
    close(simulate(restored!).readings.resistor.current, 7 / 340);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("imports reject missing pins, duplicated ids, and invalid values", () => {
  const missing = resistorLoop();
  missing.wires[0].to.pin = "missing";
  assert.throws(() => parseCircuit(JSON.stringify(missing)), /Invalid wire/);
  const duplicate = resistorLoop();
  duplicate.parts[1].id = "B";
  assert.throws(
    () => parseCircuit(JSON.stringify(duplicate)),
    /Invalid component/,
  );
  const zero = resistorLoop();
  zero.parts[1].value = 0;
  assert.throws(() => parseCircuit(JSON.stringify(zero)), /Invalid component/);
});

test("conflicting parallel ideal sources stop the solve", () => {
  const c = resistorLoop();
  c.parts.push(part("battery", "B2", 5));
  c.wires.push(wire("B", "p", "B2", "p"), wire("B", "n", "B2", "n"));
  const s = simulate(c);
  assert.equal(s.valid, false);
  assert.ok(
    s.diagnostics.some((d) => /Conflicting or redundant/.test(d.message)),
  );
});

test("voltmeter measures a node difference but refuses unrelated islands", () => {
  const c = resistorLoop();
  c.parts.push(part("multimeter", "VM"));
  c.wires.push(wire("VM", "a", "B", "p"), wire("VM", "b", "B", "n"));
  close(simulate(c).readings.VM.voltage, 10);
  c.parts.push(part("resistor", "isolated", 1000));
  c.wires[c.wires.length - 1] = wire("VM", "b", "isolated", "a");
  const s = simulate(c);
  assert.equal(s.readings.VM, undefined);
  assert.ok(
    s.diagnostics.some((d) => /same electrical island/.test(d.message)),
  );
});

test("generic diode does not inherit LED current-rating warnings", () => {
  const c = resistorLoop();
  c.parts[1] = { ...part("diode", "D", 0.7) };
  c.wires = [wire("B", "p", "D", "a"), wire("D", "b", "B", "n")];
  const s = simulate(c);
  assert.equal(s.valid, true);
  close(s.readings.D.current, 0.93);
  assert.ok(!s.diagnostics.some((d) => /LED current/.test(d.message)));
});

test("unconnected switch voltage remains unavailable", () => {
  const c = resistorLoop();
  c.parts.push(part("switch", "S"));
  const s = simulate(c);
  assert.ok(Number.isNaN(s.readings.S.voltage));
  close(s.readings.S.current, 0);
});

test("project imports reject unsafe identifiers and invalid rotations", () => {
  for (const id of ["", "__proto__", "part:pin", "x".repeat(101)]) {
    const c = resistorLoop();
    c.parts[0].id = id;
    assert.throws(() => parseCircuit(JSON.stringify(c)), /Invalid component/);
  }
  const c = resistorLoop();
  c.parts[0].rotation = 1e308;
  assert.throws(() => parseCircuit(JSON.stringify(c)), /Invalid component/);
});

test("resistances with nonfinite conductance are rejected explicitly", () => {
  const c = resistorLoop();
  c.parts[1].value = 1e-323;
  assert.throws(() => parseCircuit(JSON.stringify(c)), /Invalid component/);
  const s = simulate(c);
  assert.equal(s.valid, false);
  assert.ok(
    s.diagnostics.some((d) => /invalid component value/.test(d.message)),
  );
});

function divider(position = 0.5) {
  const pot = { ...part("potentiometer", "P", 10000), wiper: position };
  return circuit(
    [part("battery", "B", 10), pot, part("multimeter", "VM")],
    [
      wire("B", "p", "P", "a"),
      wire("B", "n", "P", "b"),
      wire("VM", "a", "P", "w"),
      wire("VM", "b", "P", "b"),
    ],
  );
}

test("potentiometer produces calculated wiper voltage over its travel", () => {
  for (const position of [0, 0.25, 0.5, 0.75, 1]) {
    const s = simulate(divider(position));
    assert.equal(s.valid, true, JSON.stringify(s.diagnostics));
    close(s.readings.VM.voltage, 10 * (1 - position));
    close(s.readings.P.power, 0.01);
    close(s.readings.B.current, -0.001);
    assert.ok(Object.keys(s.readings).every((id) => !id.includes(":")));
  }
});

test("wiper loading obeys KCL and changes divider voltage", () => {
  const c = divider();
  c.parts.push(part("resistor", "load", 5000));
  c.wires.push(wire("load", "a", "P", "w"), wire("load", "b", "P", "b"));
  const s = simulate(c);
  close(s.readings.VM.voltage, 10 / 3);
  const currents = s.readings.P.terminalCurrents!;
  close(currents.a + currents.b + currents.w, 0);
  close(currents.w, -s.readings.load.current);
  close(s.sourcePower, s.readings.P.power + s.readings.load.power);
});

test("coincident wiper/end pin currents are unavailable rather than fabricated", () => {
  const s = simulate(divider(0));
  assert.ok(Number.isNaN(s.readings.P.current));
  assert.ok(Number.isNaN(s.readings.P.terminalCurrents!.w));
  close(s.readings.P.terminalCurrents!.b, -0.001);
});

test("legacy potentiometers default to a midpoint wiper", () => {
  const c = divider();
  delete c.parts[1].wiper;
  close(simulate(parseCircuit(JSON.stringify(c))).readings.VM.voltage, 5);
});

test("ammeter measures signed series current without adding a voltage drop", () => {
  const c = resistorLoop();
  c.parts.push({ ...part("multimeter", "AM"), meterMode: "current" });
  c.wires[0] = wire("B", "p", "AM", "a");
  c.wires.push(wire("AM", "b", "R", "a"));
  let s = simulate(c);
  assert.equal(s.valid, true);
  close(s.readings.AM.current, 0.01);
  close(s.readings.AM.voltage, 0);
  close(s.sourcePower, 0.1);
  for (const w of c.wires)
    for (const e of [w.from, w.to])
      if (e.part === "AM") e.pin = e.pin === "a" ? "b" : "a";
  s = simulate(c);
  close(s.readings.AM.current, -0.01);
});

test("ammeter across a source rejects the short and explains series insertion", () => {
  const c = resistorLoop();
  c.parts.push({ ...part("multimeter", "AM"), meterMode: "current" });
  c.wires.push(wire("AM", "a", "B", "p"), wire("AM", "b", "B", "n"));
  const s = simulate(c);
  assert.equal(s.valid, false);
  assert.ok(
    s.diagnostics.some((d) => /insert the meter in series/.test(d.message)),
  );
});

test("bypassed ammeter does not report a determinate branch current", () => {
  const c = resistorLoop();
  c.parts.push({ ...part("multimeter", "AM"), meterMode: "current" });
  c.wires.push(wire("AM", "a", "B", "p"), wire("AM", "b", "B", "p"));
  const s = simulate(c);
  assert.equal(s.valid, false);
  assert.ok(s.diagnostics.some((d) => /bypassed/.test(d.message)));
});

test("new component settings round-trip and invalid settings are rejected", () => {
  const c = divider(0.25);
  c.parts[2].meterMode = "current";
  assert.deepEqual(parseCircuit(JSON.stringify(c)), c);
  for (const value of [-0.1, 1.1, "half"]) {
    const data = JSON.parse(JSON.stringify(c));
    data.parts[1].wiper = value;
    assert.throws(
      () => parseCircuit(JSON.stringify(data)),
      /Invalid component/,
    );
  }
  const data = JSON.parse(JSON.stringify(c));
  data.parts[2].meterMode = "resistance";
  assert.throws(() => parseCircuit(JSON.stringify(data)), /Invalid component/);
  c.parts[1].value = 0;
  assert.throws(() => parseCircuit(JSON.stringify(c)), /Invalid component/);
});
