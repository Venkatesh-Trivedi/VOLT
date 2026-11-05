import type { CatalogItem, Circuit, Kind, Part, Pin } from "./types.ts";
export const catalog: CatalogItem[] = [
  {
    kind: "resistor",
    name: "Resistor",
    category: "Basics",
    description: "Limits current",
    value: 330,
    unit: "Ω",
    supported: true,
    prefix: "R",
  },
  {
    kind: "led",
    name: "LED",
    category: "Outputs",
    description: "Polarity-aware light",
    value: 2,
    unit: "V forward",
    supported: true,
    prefix: "D",
  },
  {
    kind: "battery",
    name: "Battery",
    category: "Power",
    description: "Ideal DC source",
    value: 9,
    unit: "V",
    supported: true,
    prefix: "B",
  },
  {
    kind: "switch",
    name: "Switch",
    category: "Basics",
    description: "Open or close a circuit",
    value: 0,
    unit: "",
    supported: true,
    prefix: "S",
  },
  {
    kind: "breadboard",
    name: "Breadboard",
    category: "Boards",
    description: "Connected strips & rails",
    value: 0,
    unit: "",
    supported: true,
    prefix: "BB",
  },
  {
    kind: "supply",
    name: "DC supply",
    category: "Power",
    description: "Adjustable ideal source",
    value: 5,
    unit: "V",
    supported: true,
    prefix: "V",
  },
  {
    kind: "ground",
    name: "Ground",
    category: "Power",
    description: "Zero-volt reference",
    value: 0,
    unit: "",
    supported: true,
    prefix: "G",
  },
  {
    kind: "multimeter",
    name: "Multimeter",
    category: "Power",
    description: "DC voltage, series current, and resistance",
    value: 0,
    unit: "",
    supported: true,
    prefix: "VM",
  },
  {
    kind: "diode",
    name: "Diode",
    category: "Basics",
    description: "Forward-conduction model",
    value: 0.7,
    unit: "V forward",
    supported: true,
    prefix: "D",
  },
  {
    kind: "pushbutton",
    name: "Pushbutton",
    category: "Basics",
    description: "Momentary ideal contact",
    value: 0,
    unit: "",
    supported: true,
    prefix: "SW",
  },
  {
    kind: "potentiometer",
    name: "Potentiometer",
    category: "Basics",
    description: "Adjustable three-terminal divider",
    value: 10000,
    unit: "Ω",
    supported: true,
    prefix: "RV",
  },
  {
    kind: "capacitor",
    name: "Capacitor",
    category: "Basics",
    description: "Transient model planned",
    value: 100,
    unit: "µF",
    supported: false,
    prefix: "C",
  },
  {
    kind: "motor",
    name: "DC motor",
    category: "Outputs",
    description: "Motor model planned",
    value: 6,
    unit: "V",
    supported: false,
    prefix: "M",
  },
  {
    kind: "buzzer",
    name: "Buzzer",
    category: "Outputs",
    description: "Audio model planned",
    value: 5,
    unit: "V",
    supported: false,
    prefix: "BZ",
  },
  {
    kind: "logic",
    name: "Logic gate",
    category: "Boards",
    description: "Digital solver planned",
    value: 0,
    unit: "",
    supported: false,
    prefix: "IC",
  },
  {
    kind: "arduino",
    name: "Arduino Uno",
    category: "Boards",
    description: "Code execution planned",
    value: 5,
    unit: "V",
    supported: false,
    prefix: "U",
  },
];
export const meta = (kind: Kind) => catalog.find((p) => p.kind === kind)!;
export function createPart(
  kind: Kind,
  x: number,
  y: number,
  parts: Part[] = [],
): Part {
  const m = meta(kind);
  let n = 1;
  while (parts.some((p) => p.label === `${m.prefix}${n}`)) n++;
  return {
    id: crypto.randomUUID(),
    kind,
    label: `${m.prefix}${n}`,
    x,
    y,
    rotation: 0,
    value: m.value,
    closed: false,
    color: "coral",
  };
}
export function dimensions(kind: Kind) {
  return kind === "breadboard"
    ? { w: 560, h: 254 }
    : kind === "battery"
      ? { w: 92, h: 134 }
      : kind === "supply"
        ? { w: 136, h: 92 }
        : kind === "arduino"
          ? { w: 150, h: 100 }
          : { w: 100, h: 70 };
}
export function pins(part: Part): Pin[] {
  if (part.kind === "breadboard") {
    const result: Pin[] = [];
    for (let col = 1; col <= 25; col++) {
      const x = 40 + (col - 1) * 20;
      for (const [i, row] of [..."abcdefghij"].entries())
        result.push({
          id: `${row}${col}`,
          label: `${row}${col}`,
          x,
          y: i < 5 ? 65 + i * 13 : 148 + (i - 5) * 13,
        });
      for (const [rail, y] of [
        ["tp", 20],
        ["tn", 35],
        ["bp", 222],
        ["bn", 237],
      ] as const)
        result.push({
          id: `${rail}${col}`,
          label: `${rail.startsWith("t") ? "Top" : "Bottom"} ${rail.endsWith("p") ? "+" : "−"} ${col}`,
          x,
          y,
        });
    }
    return result;
  }
  if (part.kind === "potentiometer")
    return [
      { id: "a", label: "End 1", x: 0, y: 35 },
      { id: "w", label: "Wiper", x: 50, y: 70 },
      { id: "b", label: "End 2", x: 100, y: 35 },
    ];
  if (part.kind === "ground")
    return [{ id: "g", label: "Ground", x: 50, y: 0 }];
  if (part.kind === "multimeter")
    return [
      { id: "a", label: "Positive probe (+)", x: 0, y: 35 },
      { id: "b", label: "Negative probe (−)", x: 100, y: 35 },
    ];
  if (part.kind === "battery")
    return [
      { id: "p", label: "+", x: 28, y: 0 },
      { id: "n", label: "−", x: 64, y: 0 },
    ];
  if (part.kind === "supply")
    return [
      { id: "p", label: "+", x: 42, y: 92 },
      { id: "n", label: "−", x: 94, y: 92 },
    ];
  return [
    {
      id: "a",
      label: ["led", "diode", "multimeter"].includes(part.kind)
        ? "Anode / +"
        : "1",
      x: 0,
      y: 35,
    },
    {
      id: "b",
      label: ["led", "diode", "multimeter"].includes(part.kind)
        ? "Cathode / −"
        : "2",
      x: 100,
      y: 35,
    },
  ];
}
export function pinPosition(part: Part, pinId: string) {
  const pin = pins(part).find((p) => p.id === pinId)!;
  const { w, h } = dimensions(part.kind),
    angle = (part.rotation * Math.PI) / 180;
  const dx = pin.x - w / 2,
    dy = pin.y - h / 2;
  return {
    x: part.x + w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: part.y + h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}
export function breadboardGroup(pin: string) {
  const rail = /^(tp|tn|bp|bn)\d+$/.exec(pin);
  if (rail) return rail[1];
  const hole = /^([a-j])(\d+)$/.exec(pin);
  return hole ? `${hole[1] <= "e" ? "top" : "bottom"}${hole[2]}` : pin;
}
export function starterCircuit(): Circuit {
  const board = { ...createPart("breadboard", 230, 230), id: "board" };
  const battery = { ...createPart("battery", 70, 290), id: "battery" };
  const resistor = { ...createPart("resistor", 320, 100), id: "resistor" };
  const led = { ...createPart("led", 570, 100), id: "led" };
  const sw = { ...createPart("switch", 440, 540), id: "switch", closed: true };
  const wires = [
    ["battery", "p", "board", "tp2", "coral"],
    ["board", "tp8", "resistor", "a", "coral"],
    ["resistor", "b", "board", "a11", "blue"],
    ["board", "e11", "led", "a", "blue"],
    ["led", "b", "board", "a22", "mint"],
    ["board", "e22", "switch", "a", "mint"],
    ["switch", "b", "board", "tn22", "chalk"],
    ["board", "tn2", "battery", "n", "chalk"],
  ].map(([a, ap, b, bp, color], i) => ({
    id: `wire-${i}`,
    from: { part: a, pin: ap },
    to: { part: b, pin: bp },
    color,
  }));
  return {
    version: 1,
    name: "First light",
    parts: [board, battery, resistor, led, sw],
    wires,
  };
}
