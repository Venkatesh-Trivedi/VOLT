import { dimensions, pinPosition, pins } from "./catalog.ts";
import type { Part } from "./types.ts";

type Point = { x: number; y: number };
type Port = Point & {
  exit?: { axis: "x" | "y"; direction: number; min: number; max: number };
};
const clearance = 16;

export function wirePort(part: Part, pinId: string): Port {
  const point = pinPosition(part, pinId);
  if (part.kind === "breadboard") return point;

  const pin = pins(part).find((p) => p.id === pinId)!;
  const { w, h } = dimensions(part.kind);
  const localX = pin.x === 0 ? -1 : pin.x === w ? 1 : 0;
  const localY = pin.y === 0 ? -1 : pin.y === h ? 1 : 0;
  const angle = (part.rotation * Math.PI) / 180;
  const dx = Math.round(localX * Math.cos(angle) - localY * Math.sin(angle));
  const dy = Math.round(localX * Math.sin(angle) + localY * Math.cos(angle));
  const horizontal = dx !== 0;
  const rotated = part.rotation % 180 !== 0;
  const center = horizontal ? part.y + h / 2 : part.x + w / 2;
  const span = horizontal ? (rotated ? w : h) : rotated ? h : w;
  return {
    ...point,
    exit: {
      axis: horizontal ? "x" : "y",
      direction: dx || dy,
      min: center - span / 2,
      max: center + span / 2,
    },
  };
}

// shortcut: routes account for endpoint parts only, add obstacle routing for crowded boards.
export function wireRoute(a: Port, b: Port) {
  if (a.x === b.x && a.y === b.y) return `M${a.x},${a.y}`;
  const tip = (port: Port): Point => {
    if (!port.exit) return port;
    const { axis, direction } = port.exit;
    return { ...port, [axis]: port[axis] + direction * clearance };
  };
  const start = tip(a),
    end = tip(b);
  const exits = [a.exit, b.exit].filter((exit) => exit !== undefined);
  let bends: Point[];
  if (a.exit && b.exit && a.exit.axis !== b.exit.axis) {
    bends = [
      a.exit.axis === "x" ? { x: start.x, y: end.y } : { x: end.x, y: start.y },
    ];
  } else {
    const axis = exits[0]?.axis === "x" ? "y" : "x";
    const desired =
      (start[axis] + end[axis]) / 2 +
      exits.reduce((sum, exit) => sum + exit.direction * 6, 0);
    const candidates = [
      desired,
      ...exits.flatMap((exit) => [exit.min - clearance, exit.max + clearance]),
    ];
    const lane = candidates
      .filter((value) =>
        exits.every(
          (exit) =>
            value <= exit.min - clearance || value >= exit.max + clearance,
        ),
      )
      .sort(
        (left, right) => Math.abs(left - desired) - Math.abs(right - desired),
      )[0];
    bends = [
      { ...start, [axis]: lane },
      { ...end, [axis]: lane },
    ];
  }
  return [a, start, ...bends, end, b]
    .filter(
      (p, i, points) =>
        !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
    )
    .map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`)
    .join(" ");
}
