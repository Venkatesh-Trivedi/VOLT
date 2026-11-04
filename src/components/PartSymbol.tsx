import type { Part, Reading } from "../model/types";
import { dimensions } from "../model/catalog";
import { formatValue } from "../model/persistence";
export function PartSymbol({
  part: p,
  reading,
}: {
  part: Part;
  reading?: Reading;
}) {
  const { w, h } = dimensions(p.kind);
  if (p.kind === "breadboard")
    return (
      <g className="breadboard">
        <rect width={w} height={h} rx="9" className="board-shadow" />
        <rect width={w} height={h - 5} rx="9" className="board-body" />
        <path d="M24 11H534 M24 214H534" className="rail-positive" />
        <path d="M24 44H534 M24 246H534" className="rail-negative" />
        <rect
          x="24"
          y="126"
          width="510"
          height="14"
          rx="3"
          className="board-gap"
        />
        {["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((r, i) => (
          <text
            key={r}
            x="14"
            y={(i < 5 ? 65 + i * 13 : 148 + (i - 5) * 13) + 3}
            className="board-index"
          >
            {r}
          </text>
        ))}
        {Array.from({ length: 25 }, (_, i) => (
          <g key={i}>
            <text x={40 + i * 20} y="56" className="board-index">
              {i + 1}
            </text>
            <text x={40 + i * 20} y="210" className="board-index">
              {i + 1}
            </text>
          </g>
        ))}
        <text x="13" y="24" className="board-plus">
          +
        </text>
        <text x="13" y="39" className="board-minus">
          −
        </text>
        <text x="13" y="226" className="board-plus">
          +
        </text>
        <text x="13" y="241" className="board-minus">
          −
        </text>
      </g>
    );
  if (p.kind === "battery")
    return (
      <g>
        <path d="M28 0V17M64 0V17" className="lead" />
        <rect
          x="16"
          y="10"
          width="64"
          height="120"
          rx="8"
          className="battery-body"
        />
        <rect
          x="16"
          y="10"
          width="64"
          height="38"
          rx="7"
          className="battery-cap"
        />
        <path d="M16 40H80" className="battery-seam" />
        <text x="48" y="36" className="battery-brand">
          VOLT
        </text>
        <text x="48" y="81" className="battery-value">
          {p.value}
          <tspan fontSize="11"> V</tspan>
        </text>
        <text x="48" y="103" className="battery-detail">
          DC source
        </text>
        <text x="28" y="-12" className="pin-polarity">
          +
        </text>
        <text x="64" y="-12" className="pin-polarity">
          −
        </text>
      </g>
    );
  if (p.kind === "resistor")
    return (
      <g>
        <path d="M0 35H100" className="lead" />
        <path
          d="M25 25Q20 35 25 45H75Q80 35 75 25Z"
          className="resistor-body"
        />
        <path d="M33 25V45" className="resistor-band band-orange" />
        <path d="M43 25V45" className="resistor-band band-orange" />
        <path d="M53 25V45" className="resistor-band band-brown" />
        <path d="M68 25V45" className="resistor-band band-gold" />
        <text x="50" y="66" className="part-value">
          {formatValue(p.value, "Ω", 0)}
        </text>
      </g>
    );
  if (p.kind === "potentiometer")
    return (
      <g>
        <path d="M0 35H25M75 35H100M50 70V48" className="lead" />
        <rect
          x="25"
          y="24"
          width="50"
          height="22"
          rx="3"
          className="resistor-body"
        />
        <path d={`M${25 + (p.wiper ?? 0.5) * 50} 39L50 55`} className="lead" />
        <text x="50" y="16" className="part-value">
          {formatValue(p.value, "Ω", 0)} / {Math.round((p.wiper ?? 0.5) * 100)}%
        </text>
      </g>
    );
  if (p.kind === "led")
    return (
      <g
        className={`led-symbol color-${p.color} ${reading?.lit ? "is-lit" : ""}`}
      >
        <path d="M0 35H33M67 35H100" className="lead" />
        {reading?.lit && <circle cx="50" cy="30" r="36" className="led-halo" />}
        <path d="M34 36V24a16 16 0 0132 0v12z" className="led-dome" />
        <rect x="31" y="34" width="38" height="7" rx="2" className="led-base" />
        <path d="M42 23Q42 16 48 15" className="led-shine" />
        <text x="13" y="58" className="pin-polarity">
          +
        </text>
        <text x="87" y="58" className="pin-polarity">
          −
        </text>
      </g>
    );
  if (p.kind === "switch" || p.kind === "pushbutton")
    return (
      <g>
        <path d="M0 35H26M74 35H100" className="lead" />
        <rect
          x="20"
          y="14"
          width="60"
          height="42"
          rx="5"
          className="switch-body"
        />
        <rect
          x={p.closed ? "45" : "25"}
          y="19"
          width="29"
          height="32"
          rx="3"
          className={p.closed ? "switch-on" : "switch-off"}
        />
        <path
          d={p.closed ? "M56 26V43" : "M36 26V43"}
          className="switch-mark"
        />
        <text x="50" y="76" className="part-value">
          {p.closed ? "Closed" : "Open"}
        </text>
      </g>
    );
  if (p.kind === "ground")
    return (
      <g>
        <path d="M50 0V25M29 25H71M36 33H64M43 41H57" className="lead" />
      </g>
    );
  if (p.kind === "supply")
    return (
      <g>
        <rect width="136" height="85" rx="8" className="instrument-body" />
        <rect
          x="12"
          y="12"
          width="112"
          height="39"
          rx="3"
          className="instrument-screen"
        />
        <text x="68" y="39" className="instrument-value">
          {p.value.toFixed(1)} V
        </text>
        <text x="68" y="68" className="part-value">
          DC power supply
        </text>
        <path d="M42 77V92M94 77V92" className="lead" />
      </g>
    );
  if (p.kind === "multimeter")
    return (
      <g>
        <path d="M0 35H100" className="lead" />
        <rect
          x="15"
          y="4"
          width="70"
          height="58"
          rx="7"
          className="meter-body"
        />
        <rect
          x="21"
          y="11"
          width="58"
          height="26"
          rx="2"
          className="instrument-screen"
        />
        <text x="50" y="29" className="meter-value">
          {reading
            ? p.meterMode === "current"
              ? formatValue(reading.current, "A", 2)
              : formatValue(reading.voltage, "V", 2)
            : p.meterMode === "current"
              ? "DC A"
              : "DC V"}
        </text>
        <circle cx="50" cy="49" r="7" className="meter-dial" />
      </g>
    );
  if (p.kind === "diode")
    return (
      <g>
        <path d="M0 35H100" className="lead" />
        <rect
          x="29"
          y="24"
          width="43"
          height="23"
          rx="4"
          className="diode-body"
        />
        <path d="M63 24V47" className="diode-band" />
        <text x="50" y="66" className="part-value">
          {p.value} V
        </text>
      </g>
    );
  if (p.kind === "capacitor")
    return (
      <g>
        <path d="M0 35H39M61 35H100M39 13V57M61 13V57" className="lead" />
      </g>
    );
  return (
    <g>
      <rect
        x="9"
        y="7"
        width={w - 18}
        height={h - 14}
        rx="7"
        className="placeholder-body"
      />
      <text x={w / 2} y={h / 2 - 2} className="placeholder-label">
        {p.kind === "arduino"
          ? "Arduino Uno"
          : p.kind === "logic"
            ? "AND"
            : p.kind}
      </text>
      <text x={w / 2} y={h / 2 + 15} className="placeholder-note">
        Model planned
      </text>
    </g>
  );
}
