import { Battery, CircuitBoard, Cpu, Gauge } from "lucide-react";
import type { Kind } from "../model/types";
import { meta } from "../model/catalog";
import { PartSymbol } from "./PartSymbol";
export function LibraryPreview({ kind }: { kind: Kind }) {
  if (kind === "breadboard")
    return <CircuitBoard size={35} strokeWidth={1.3} />;
  if (kind === "battery") return <Battery size={33} strokeWidth={1.4} />;
  if (kind === "supply") return <Gauge size={33} strokeWidth={1.4} />;
  if (kind === "arduino" || kind === "logic")
    return <Cpu size={32} strokeWidth={1.3} />;
  return (
    <svg viewBox="-5 0 110 70" width="74" height="48" aria-hidden="true">
      <PartSymbol
        part={{
          id: "preview",
          kind,
          label: "",
          x: 0,
          y: 0,
          rotation: 0,
          value: meta(kind).value,
          closed: false,
          color: "coral",
        }}
      />
    </svg>
  );
}
