export type Kind =
  | "resistor"
  | "battery"
  | "supply"
  | "led"
  | "switch"
  | "ground"
  | "breadboard"
  | "capacitor"
  | "motor"
  | "buzzer"
  | "arduino"
  | "logic"
  | "pushbutton"
  | "potentiometer"
  | "diode"
  | "multimeter";
export type Category = "All parts" | "Basics" | "Power" | "Outputs" | "Boards";
export interface Part {
  id: string;
  kind: Kind;
  label: string;
  x: number;
  y: number;
  rotation: number;
  value: number;
  closed: boolean;
  color: string;
  wiper?: number;
  meterMode?: "voltage" | "current" | "resistance";
}
export interface Endpoint {
  part: string;
  pin: string;
}
export interface Wire {
  id: string;
  from: Endpoint;
  to: Endpoint;
  color: string;
}
export interface Circuit {
  version: 1;
  name: string;
  parts: Part[];
  wires: Wire[];
}
export interface Pin {
  id: string;
  label: string;
  x: number;
  y: number;
}
export interface CatalogItem {
  kind: Kind;
  name: string;
  category: Category;
  description: string;
  value: number;
  unit: string;
  supported: boolean;
  prefix: string;
}
export interface Reading {
  resistance?: number;
  voltage: number;
  current: number;
  power: number;
  lit?: boolean;
  motorSpeed?: number;
  buzzing?: boolean;
  terminalCurrents?: Record<string, number>;
}
export interface Diagnostic {
  level: "info" | "warning" | "error";
  message: string;
}
export interface Simulation {
  readings: Record<string, Reading>;
  pinVoltages: Record<string, number>;
  diagnostics: Diagnostic[];
  valid: boolean;
  nodes: number;
  sourcePower: number;
}
export type Selection = { type: "part" | "wire"; id: string } | null;
export const wireColors = ["coral", "blue", "mint", "amber", "chalk"] as const;
export const endpointKey = (e: Endpoint) => `${e.part}:${e.pin}`;
