import { useEffect, useRef, useState } from "react";
import {
  Hand,
  MousePointer2,
  Cable,
  Minus,
  Plus,
  Maximize,
  RotateCw,
  Copy,
  Trash2,
} from "lucide-react";
import {
  dimensions,
  pinPosition,
  pins,
  createPart,
  meta,
} from "../model/catalog";
import { endpointKey } from "../model/types";
import type {
  Circuit,
  Endpoint,
  Kind,
  Selection,
  Simulation,
} from "../model/types";
import { PartSymbol } from "./PartSymbol";
import { formatValue } from "../model/persistence";

type Point = { x: number; y: number };
type Props = {
  circuit: Circuit;
  commit: (next: Circuit | ((current: Circuit) => Circuit)) => void;
  selection: Selection;
  select: (s: Selection) => void;
  result: Simulation | null;
  running: boolean;
  wireColor: string;
  setWireColor: (color: string) => void;
  pending: Endpoint | null;
  setPending: (e: Endpoint | null) => void;
  onPin: (e: Endpoint) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onRotate: () => void;
  onToggle: (id: string, closed?: boolean) => void;
  activePin: Endpoint | null;
  net: Record<string, string>;
};
export function Workbench({
  circuit,
  commit,
  selection,
  select,
  result,
  running,
  wireColor,
  setWireColor,
  pending,
  setPending,
  onPin,
  onRemove,
  onDuplicate,
  onRotate,
  onToggle,
  activePin,
  net,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState<Point>({ x: 20, y: 5 });
  const [tool, setTool] = useState<"select" | "pan" | "wire">("select");
  const [drag, setDrag] = useState<{
    id: string;
    start: Point;
    origin: Point;
    now: Point;
  } | null>(null);
  const [panning, setPanning] = useState<{
    start: Point;
    origin: Point;
  } | null>(null);
  const [mouse, setMouse] = useState<Point>({ x: 0, y: 0 });
  const point = (clientX: number, clientY: number): Point => {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };
  const displayParts = circuit.parts.map((p) =>
    drag?.id === p.id ? { ...p, x: drag.now.x, y: drag.now.y } : p,
  );
  const getPoint = (e: Endpoint) => {
    const p = displayParts.find((p) => p.id === e.part);
    return p ? pinPosition(p, e.pin) : { x: 0, y: 0 };
  };
  const route = (a: Point, b: Point) => {
    const middle = (a.x + b.x) / 2;
    return `M${a.x},${a.y} H${middle} V${b.y} H${b.x}`;
  };
  function fitView() {
    if (!svg.current || !circuit.parts.length) {
      setZoom(0.85);
      setPan({ x: 20, y: 5 });
      return;
    }
    const rect = svg.current.getBoundingClientRect();
    const bounds = circuit.parts.map((p) => {
      const { w, h } = dimensions(p.kind);
      const angle = p.rotation * Math.PI / 180;
      const halfW = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
      const halfH = (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
      return { left: p.x + w / 2 - halfW, right: p.x + w / 2 + halfW, top: p.y + h / 2 - halfH, bottom: p.y + h / 2 + halfH };
    });
    const minX = Math.min(...bounds.map(p => p.left)) - 35;
    const minY = Math.min(...bounds.map(p => p.top)) - 55;
    const maxX = Math.max(...bounds.map(p => p.right)) + 35;
    const maxY = Math.max(...bounds.map(p => p.bottom)) + 65;
    const scale = Math.max(
      0.15,
      Math.min(1, rect.width / (maxX - minX), rect.height / (maxY - minY)),
    );
    setZoom(scale);
    setPan({
      x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
      y: (rect.height - (maxY - minY) * scale) / 2 - minY * scale,
    });
  }
  const fitCurrentView = useRef(fitView);
  fitCurrentView.current = fitView;
  useEffect(() => {
    const observer = new ResizeObserver(() => fitCurrentView.current());
    if (svg.current) observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
  function finishDrag() {
    if (drag) {
      const source = circuit.parts.find((p) => p.id === drag.id)!;
      let moved = { ...source, x: drag.now.x, y: drag.now.y };
      let connection: { from: Endpoint; to: Endpoint } | null = null;
      let distance = 12;
      if (moved.kind !== "breadboard")
        for (const board of circuit.parts.filter(
          (p) => p.kind === "breadboard",
        ))
          for (const pin of pins(moved))
            for (const hole of pins(board)) {
              const a = pinPosition(moved, pin.id),
                b = pinPosition(board, hole.id);
              const d = Math.hypot(a.x - b.x, a.y - b.y);
              if (d < distance) {
                distance = d;
                connection = {
                  from: { part: moved.id, pin: pin.id },
                  to: { part: board.id, pin: hole.id },
                };
              }
            }
      if (connection) {
        const a = pinPosition(moved, connection.from.pin),
          b = pinPosition(
            circuit.parts.find((p) => p.id === connection!.to.part)!,
            connection.to.pin,
          );
        moved = { ...moved, x: moved.x + b.x - a.x, y: moved.y + b.y - a.y };
      }
      const contacts: { from: Endpoint; to: Endpoint }[] = [];
      if (connection)
        for (const pin of pins(moved)) {
          const a = pinPosition(moved, pin.id);
          for (const board of circuit.parts.filter(
            (p) => p.kind === "breadboard",
          )) {
            const hole = pins(board).find((h) => {
              const b = pinPosition(board, h.id);
              return Math.hypot(a.x - b.x, a.y - b.y) < 0.5;
            });
            if (hole) {
              contacts.push({
                from: { part: moved.id, pin: pin.id },
                to: { part: board.id, pin: hole.id },
              });
              break;
            }
          }
        }
      if (moved.x !== source.x || moved.y !== source.y)
        commit((c) => ({
          ...c,
          parts: c.parts.map((p) => (p.id === moved.id ? moved : p)),
          wires: [
            ...c.wires,
            ...contacts
              .filter(
                (snap) =>
                  !c.wires.some(
                    (w) =>
                      (endpointKey(w.from) === endpointKey(snap.from) &&
                        endpointKey(w.to) === endpointKey(snap.to)) ||
                      (endpointKey(w.to) === endpointKey(snap.from) &&
                        endpointKey(w.from) === endpointKey(snap.to)),
                  ),
              )
              .map((snap) => ({
                id: crypto.randomUUID(),
                ...snap,
                color: wireColor,
              })),
          ],
        }));
      setDrag(null);
    }
    setPanning(null);
  }
  const activeBoardPin = activePin
    ? circuit.parts.find(
        (p) => p.id === activePin.part && p.kind === "breadboard",
      )
    : null;
  return (
    <section className="workbench" aria-label="Circuit workbench">
      <div className="canvas-toolbar">
        <div className="tool-group">
          <button
            className={tool === "select" ? "selected" : ""}
            title="Select and move components"
            aria-label="Select tool"
            onClick={() => {
              setTool("select");
              setPending(null);
            }}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            className={tool === "pan" ? "selected" : ""}
            title="Pan canvas"
            aria-label="Pan tool"
            onClick={() => setTool("pan")}
          >
            <Hand size={17} />
          </button>
          <button
            className={tool === "wire" ? "selected" : ""}
            title="Connect two pins"
            aria-label="Wire tool"
            onClick={() => setTool("wire")}
          >
            <Cable size={18} />
          </button>
        </div>
        <span className="toolbar-divider" />
        <div className="wire-colors" aria-label="Wire color">
          {["coral", "blue", "mint", "amber", "chalk"].map((color) => (
            <button
              key={color}
              aria-label={`${color} wire`}
              title={`${color} wire`}
              className={`swatch color-${color} ${wireColor === color ? "chosen" : ""}`}
              onClick={() => setWireColor(color)}
            />
          ))}
        </div>
        <div className="toolbar-spacer" />
        <span className="canvas-mode">
          {running ? "Live DC analysis" : "Circuit editor"}
        </span>
        <span className="coordinate-label">Free placement</span>
      </div>
      <svg
        ref={svg}
        className={`circuit-canvas tool-${tool}`}
        aria-label="Interactive electronics canvas"
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const kind = e.dataTransfer.getData(
            "application/voltage-part",
          ) as Kind;
          if (!meta(kind)) return;
          const pos = point(e.clientX, e.clientY);
          const p = createPart(kind, pos.x, pos.y, circuit.parts);
          commit({ ...circuit, parts: [...circuit.parts, p] });
          select({ type: "part", id: p.id });
        }}
        onWheel={(e) => {
          const next = Math.min(
            2,
            Math.max(0.15, zoom * (e.deltaY < 0 ? 1.1 : 0.9)),
          );
          const rect = svg.current!.getBoundingClientRect();
          const x = e.clientX - rect.left,
            y = e.clientY - rect.top;
          setPan({
            x: x - ((x - pan.x) * next) / zoom,
            y: y - ((y - pan.y) * next) / zoom,
          });
          setZoom(next);
        }}
        onPointerDown={(e) => {
          if (e.target === svg.current || tool === "pan" || e.button === 1) {
            if (tool === "pan" || e.button === 1) {
              e.currentTarget.setPointerCapture(e.pointerId);
              setPanning({
                start: { x: e.clientX, y: e.clientY },
                origin: pan,
              });
            } else {
              select(null);
              setPending(null);
            }
          }
        }}
        onPointerMove={(e) => {
          const pos = point(e.clientX, e.clientY);
          setMouse(pos);
          if (drag)
            setDrag({
              ...drag,
              now: {
                x: drag.origin.x + pos.x - drag.start.x,
                y: drag.origin.y + pos.y - drag.start.y,
              },
            });
          if (panning)
            setPan({
              x: panning.origin.x + e.clientX - panning.start.x,
              y: panning.origin.y + e.clientY - panning.start.y,
            });
        }}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          setDrag(null);
          setPanning(null);
        }}
      >
        <defs>
          <pattern
            id="dots"
            width={20 * zoom}
            height={20 * zoom}
            patternUnits="userSpaceOnUse"
            x={pan.x % (20 * zoom)}
            y={pan.y % (20 * zoom)}
          >
            <circle cx="1" cy="1" r=".8" className="grid-dot" />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#dots)"
          pointerEvents="none"
        />
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {displayParts
            .filter((p) => p.kind === "breadboard")
            .map((p) => (
              <g
                key={p.id}
                transform={`translate(${p.x},${p.y}) rotate(${p.rotation},280,127)`}
              >
                <PartSymbol part={p} />
              </g>
            ))}
          {circuit.wires.map((w) => (
            <g
              key={w.id}
              className={`wire color-${w.color} ${selection?.id === w.id ? "wire-selected" : ""}`}
            >
              <path
                d={route(getPoint(w.from), getPoint(w.to))}
                className="wire-shadow"
              />
              <path
                d={route(getPoint(w.from), getPoint(w.to))}
                className="wire-line"
              />
              <path
                d={route(getPoint(w.from), getPoint(w.to))}
                className="wire-hit"
                tabIndex={0}
                role="button"
                aria-label={`Wire from ${circuit.parts.find((p) => p.id === w.from.part)?.label} ${w.from.pin} to ${circuit.parts.find((p) => p.id === w.to.part)?.label} ${w.to.pin}`}
                onClick={(e) => {
                  e.stopPropagation();
                  select({ type: "wire", id: w.id });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") select({ type: "wire", id: w.id });
                }}
              />
            </g>
          ))}
          {displayParts.map((p) => {
            const { w, h } = dimensions(p.kind);
            const selected =
              selection?.type === "part" && selection.id === p.id;
            return (
              <g
                key={p.id}
                transform={`translate(${p.x},${p.y}) rotate(${p.rotation},${w / 2},${h / 2})`}
                className={`placed-part ${selected ? "part-selected" : ""}`}
              >
                <rect
                  x="-10"
                  y="-10"
                  width={w + 20}
                  height={h + 20}
                  rx="8"
                  className="selection-outline"
                />
                <g
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.label} ${meta(p.kind).name}; select to edit`}
                  className="part-handle"
                  onPointerDown={(e) => {
                    if (tool === "pan") return;
                    e.stopPropagation();
                    select({ type: "part", id: p.id });
                    if (e.button !== 0) return;
                    svg.current?.setPointerCapture(e.pointerId);
                    const pos = point(e.clientX, e.clientY);
                    setDrag({
                      id: p.id,
                      start: pos,
                      origin: { x: p.x, y: p.y },
                      now: { x: p.x, y: p.y },
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") select({ type: "part", id: p.id });
                    if (e.key === " " && p.kind === "switch") {
                      e.preventDefault();
                      onToggle(p.id);
                    }
                  }}
                  onDoubleClick={() => {
                    if (p.kind === "switch") onToggle(p.id);
                  }}
                >
                  <rect
                    x="-5"
                    y="-5"
                    width={w + 10}
                    height={h + 10}
                    className={
                      p.kind === "breadboard"
                        ? "part-hit board-hit"
                        : "part-hit"
                    }
                  />
                  {p.kind !== "breadboard" && (
                    <PartSymbol
                      part={p}
                      reading={
                        result?.valid ? result.readings[p.id] : undefined
                      }
                    />
                  )}
                  <text x={w / 2} y="-24" className="part-label">
                    {p.label}
                    <tspan className="part-kind"> {meta(p.kind).name}</tspan>
                  </text>
                  {p.kind === "breadboard" && (
                    <text x={w / 2} y={h + 16} className="board-caption">
                      25 columns / isolated center channel / continuous power
                      rails
                    </text>
                  )}
                </g>
                {pins(p).map((pin) => {
                  const key = `${p.id}:${pin.id}`;
                  const connected = circuit.wires.some(
                    (w) =>
                      endpointKey(w.from) === key || endpointKey(w.to) === key,
                  );
                  const active =
                    activePin?.part === p.id && activePin.pin === pin.id;
                  const isPending =
                    pending?.part === p.id && pending.pin === pin.id;
                  const sameNode =
                    activePin && net[key] === net[endpointKey(activePin)];
                  return (
                    <g
                      key={pin.id}
                      className={`pin ${p.kind === "breadboard" ? "hole" : ""} ${connected ? "connected" : ""} ${active ? "active-pin" : ""} ${isPending ? "pending-pin" : ""} ${sameNode ? "same-node" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${p.label} pin ${pin.label}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPin({ part: p.id, pin: pin.id });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPin({ part: p.id, pin: pin.id });
                        }
                      }}
                    >
                      <title>
                        {p.label} {pin.label}
                        {result?.pinVoltages[key] !== undefined
                          ? ` / ${formatValue(result.pinVoltages[key], "V")}`
                          : ""}
                      </title>
                      <circle
                        cx={pin.x}
                        cy={pin.y}
                        r={p.kind === "breadboard" ? 7 : 10}
                        className="pin-hit"
                      />
                      <circle
                        cx={pin.x}
                        cy={pin.y}
                        r={p.kind === "breadboard" ? 3.2 : 4.7}
                        className="pin-center"
                      />
                      {(active || isPending) && (
                        <circle
                          cx={pin.x}
                          cy={pin.y}
                          r="9"
                          className="pin-ring"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {pending && (
            <path
              d={route(getPoint(pending), mouse)}
              className={`wire-preview color-${wireColor}`}
            />
          )}
        </g>
        {circuit.parts.length === 0 && (
          <g className="empty-canvas">
            <text x="50%" y="43%">
              Your next circuit starts here.
            </text>
            <text x="50%" y="43%" dy="30" className="empty-canvas-hint">
              Drag a component from the library, or click one to add it.
            </text>
          </g>
        )}
      </svg>
      {selection?.type === "part" && (
        <div className="selection-actions">
          <button onClick={onRotate} title="Rotate (R)">
            <RotateCw size={16} />
            <span>Rotate</span>
          </button>
          <button onClick={onDuplicate} title="Duplicate (Ctrl+D)">
            <Copy size={16} />
            <span>Duplicate</span>
          </button>
          <button onClick={onRemove} title="Delete selection">
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}
      <div className="canvas-bottom">
        <div className="canvas-hint">
          {pending ? (
            <>
              <Cable size={15} />
              Choose a second pin to connect. Esc cancels.
            </>
          ) : activeBoardPin ? (
            <>
              <Cable size={15} />
              Hole {activePin?.pin}:{" "}
              {/^(tp|tn|bp|bn)/.test(activePin?.pin ?? "")
                ? "all 25 holes share this rail."
                : "five vertical holes share a strip."}
            </>
          ) : (
            <>
              <MousePointer2 size={14} />
              Drag to move. Click two pins to connect.
            </>
          )}
        </div>
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          >
            <Plus size={15} />
          </button>
          <button aria-label="Reset view" title="Reset view" onClick={fitView}>
            <Maximize size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
