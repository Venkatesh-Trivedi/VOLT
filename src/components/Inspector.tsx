import {
  Activity,
  Cable,
  Info,
  SlidersHorizontal,
  ToggleLeft,
  Trash2,
} from "lucide-react";
import { meta, pins } from "../model/catalog";
import { formatValue } from "../model/persistence";
import { endpointKey } from "../model/types";
import type {
  Circuit,
  Endpoint,
  Part,
  Reading,
  Simulation,
  Wire,
} from "../model/types";
import { LibraryPreview } from "./LibraryPreview";
type Props = {
  selectedPart?: Part;
  selectedWire?: Wire;
  selectedReading?: Reading;
  updatePart: (part: Part, update: Partial<Part>) => void;
  toggle: (id: string, closed?: boolean) => void;
  circuit: Circuit;
  net: Record<string, string>;
  activePin: Endpoint | null;
  result: Simulation | null;
  onPin: (pin: Endpoint) => void;
  commit: (next: Circuit) => void;
  remove: () => void;
  setNotice: (text: string) => void;
};
export function Inspector({
  selectedPart,
  selectedWire,
  selectedReading,
  updatePart,
  toggle,
  circuit,
  net,
  activePin,
  result,
  onPin,
  commit,
  remove,
  setNotice,
}: Props) {
  const positiveValue =
    selectedPart &&
    ["resistor", "potentiometer", "led", "diode", "motor", "buzzer"].includes(
      selectedPart.kind,
    );
  return (
    <aside className="inspector-panel" aria-label="Properties inspector">
      <div className="panel-heading">
        <h2>Inspector</h2>
        <SlidersHorizontal size={16} />
      </div>
      {selectedPart ? (
        <>
          <div className="inspector-identity">
            <div className="inspector-symbol">
              <LibraryPreview kind={selectedPart.kind} />
            </div>
            <div>
              <h3>{meta(selectedPart.kind).name}</h3>
              <span>
                {selectedPart.label}
                <span className="identity-separator">/</span>
                {meta(selectedPart.kind).supported
                  ? "DC model"
                  : "Placement only"}
              </span>
            </div>
          </div>
          <div className="inspector-section">
            <h4>Properties</h4>
            <label className="field-label">
              Reference
              <input
                key={`${selectedPart.id}-label`}
                defaultValue={selectedPart.label}
                maxLength={50}
                onBlur={(e) => {
                  if (e.target.value.trim())
                    updatePart(selectedPart, {
                      label: e.target.value.trim(),
                    });
                  else e.target.value = selectedPart.label;
                }}
              />
            </label>
            {meta(selectedPart.kind).unit && (
              <label className="field-label">
                {["resistor", "potentiometer"].includes(selectedPart.kind)
                  ? "Resistance"
                  : selectedPart.kind === "led" || selectedPart.kind === "diode"
                    ? "Forward voltage"
                    : selectedPart.kind === "capacitor"
                      ? "Capacitance"
                      : selectedPart.kind === "motor"
                        ? "Rated voltage"
                        : selectedPart.kind === "buzzer"
                          ? "Turn-on voltage"
                          : "Voltage / value"}
                <div className="unit-field">
                  <input
                    key={`${selectedPart.id}-${selectedPart.value}`}
                    type="number"
                    aria-label="Component value"
                    min={positiveValue ? 0.001 : 0}
                    max="1000000000"
                    step="any"
                    defaultValue={selectedPart.value}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (
                        e.target.value &&
                        Number.isFinite(value) &&
                        value >= 0 &&
                        value <= 1e9 &&
                        (!["resistor", "potentiometer"].includes(
                          selectedPart.kind,
                        ) ||
                          Number.isFinite(1 / value)) &&
                        (!positiveValue || value > 0)
                      )
                        updatePart(selectedPart, { value });
                      else {
                        e.target.value = String(selectedPart.value);
                        setNotice("Enter a valid positive component value.");
                      }
                    }}
                  />
                  <span>{meta(selectedPart.kind).unit}</span>
                </div>
              </label>
            )}
            {selectedPart.kind === "potentiometer" && (
              <label className="field-label">
                Wiper position: {Math.round((selectedPart.wiper ?? 0.5) * 100)}%
                <input
                  aria-label="Wiper position"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={(selectedPart.wiper ?? 0.5) * 100}
                  onChange={(e) =>
                    updatePart(selectedPart, {
                      wiper: Number(e.target.value) / 100,
                    })
                  }
                />
                <span>0% at end 1; 100% at end 2.</span>
              </label>
            )}
            {selectedPart.kind === "multimeter" && (
              <label className="field-label">
                Measurement mode
                <select
                  aria-label="Measurement mode"
                  value={selectedPart.meterMode ?? "voltage"}
                  onChange={(e) =>
                    updatePart(selectedPart, {
                      meterMode: e.target.value as Part["meterMode"],
                    })
                  }
                >
                  <option value="voltage">DC voltage (parallel)</option>
                  <option value="current">DC current (series)</option>
                  <option value="resistance">Resistance (unpowered)</option>
                </select>
              </label>
            )}
            {selectedPart.kind === "led" && (
              <div className="field-label">
                LED color
                <div className="led-colors">
                  {["coral", "blue", "mint", "amber"].map((color) => (
                    <button
                      aria-label={`${color} LED`}
                      key={color}
                      className={`swatch color-${color} ${selectedPart.color === color ? "chosen" : ""}`}
                      onClick={() => updatePart(selectedPart, { color })}
                    />
                  ))}
                </div>
              </div>
            )}
            {selectedPart.kind === "switch" && (
              <button
                className={`button switch-control ${selectedPart.closed ? "closed" : ""}`}
                onClick={() => toggle(selectedPart.id)}
              >
                <ToggleLeft size={18} />
                {selectedPart.closed
                  ? "Closed — click to open"
                  : "Open — click to close"}
              </button>
            )}
            {selectedPart.kind === "pushbutton" && (
              <button
                className="button switch-control"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  toggle(selectedPart.id, true);
                }}
                onPointerUp={() => toggle(selectedPart.id, false)}
                onPointerCancel={() => toggle(selectedPart.id, false)}
                onBlur={() => {
                  if (selectedPart.closed) toggle(selectedPart.id, false);
                }}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat)
                    toggle(selectedPart.id, true);
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter")
                    toggle(selectedPart.id, false);
                }}
              >
                Hold to close contact
              </button>
            )}
            <div className="two-fields">
              <label className="field-label">
                Rotation
                <select
                  value={selectedPart.rotation}
                  onChange={(e) =>
                    updatePart(selectedPart, {
                      rotation: Number(e.target.value),
                    })
                  }
                >
                  {[0, 90, 180, 270].map((a) => (
                    <option key={a} value={a}>
                      {a}°
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-label">
                Connections
                <div className="static-field">
                  {
                    circuit.wires.filter(
                      (w) =>
                        w.from.part === selectedPart.id ||
                        w.to.part === selectedPart.id,
                    ).length
                  }{" "}
                  wires
                </div>
              </div>
            </div>
          </div>
          <div className="inspector-section">
            <h4>
              Electrical readings <Activity size={13} />
            </h4>
            <dl className="reading-list">
              {selectedPart.meterMode === "resistance" ? (
                <div>
                  <dt>Resistance</dt>
                  <dd>
                    {formatValue(selectedReading?.resistance ?? NaN, "Ω")}
                  </dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt>Voltage drop</dt>
                    <dd>
                      {selectedReading
                        ? formatValue(selectedReading.voltage, "V")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {selectedPart.kind === "potentiometer"
                        ? "Current into end 1"
                        : "Current"}
                    </dt>
                    <dd>
                      {selectedReading
                        ? formatValue(selectedReading.current, "A")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Power</dt>
                    <dd>
                      {selectedReading
                        ? formatValue(selectedReading.power, "W")
                        : "—"}
                    </dd>
                  </div>
                  {selectedReading?.terminalCurrents && (
                    <>
                      <div>
                        <dt>Current into wiper</dt>
                        <dd>
                          {formatValue(selectedReading.terminalCurrents.w, "A")}
                        </dd>
                      </div>
                      <div>
                        <dt>Current into end 2</dt>
                        <dd>
                          {formatValue(selectedReading.terminalCurrents.b, "A")}
                        </dd>
                      </div>
                    </>
                  )}
                </>
              )}
            </dl>
            <p className="inspector-note">
              {!meta(selectedPart.kind).supported
                ? "This component can be placed and wired. Its electrical model is planned; pins are treated as open."
                : selectedPart.kind === "multimeter"
                  ? selectedPart.meterMode === "current"
                    ? "Ideal zero-voltage ammeter. Insert in series; across a supply it creates a short circuit. Positive current enters the + probe."
                    : selectedPart.meterMode === "resistance"
                      ? "Connect across an unpowered resistive network. OL indicates an open path."
                      : "Ideal DC voltage measurement across + and −. No current is drawn."
                  : selectedPart.kind === "potentiometer"
                    ? "Two resistive sections follow the wiper. Loading the wiper changes the divider voltage. At an end stop, currents through coincident pins are unavailable."
                    : selectedPart.kind === "resistor"
                      ? "Ideal resistor. Power warnings assume a ¼ W rating."
                      : selectedPart.kind === "led"
                        ? "Simplified diode: forward threshold + 10 Ω. Use a series resistor."
                        : selectedPart.kind === "breadboard"
                          ? "a–e and f–j form separate five-hole columns. Each power rail is continuous."
                          : selectedPart.kind === "motor"
                            ? "120 Ω DC load. Rotation speed follows the voltage relative to its rating, and reversing the leads reverses rotation."
                            : selectedPart.kind === "buzzer"
                              ? "1 kΩ DC load. The buzzer sounds with correct polarity at or above its turn-on voltage when sound is enabled."
                              : "Steady-state DC model. Readings update while the simulation runs."}
            </p>
          </div>
          <div className="inspector-section">
            <h4>
              Pin connections <Cable size={13} />
            </h4>
            {selectedPart.kind === "breadboard" ? (
              <p className="inspector-note">
                Click any hole to inspect its node or begin a wire.
              </p>
            ) : (
              <div className="pin-list">
                {pins(selectedPart).map((pin) => (
                  <button
                    key={pin.id}
                    onClick={() =>
                      onPin({ part: selectedPart.id, pin: pin.id })
                    }
                  >
                    <span className="pin-marker" />
                    <span>{pin.label}</span>
                    <strong>
                      {result?.pinVoltages[`${selectedPart.id}:${pin.id}`] !==
                      undefined
                        ? formatValue(
                            result.pinVoltages[`${selectedPart.id}:${pin.id}`],
                            "V",
                          )
                        : circuit.wires.some(
                              (w) =>
                                endpointKey(w.from) ===
                                  `${selectedPart.id}:${pin.id}` ||
                                endpointKey(w.to) ===
                                  `${selectedPart.id}:${pin.id}`,
                            )
                          ? "Connected"
                          : "Open"}
                    </strong>
                  </button>
                ))}
              </div>
            )}
            {activePin && activePin.part === selectedPart.id && (
              <div className="node-inspection">
                <strong>Selected pin: {activePin.pin}</strong>
                <span>
                  {
                    Object.values(net).filter(
                      (n) => n === net[endpointKey(activePin)],
                    ).length
                  }{" "}
                  pins share this node
                </span>
                <span>
                  {result?.pinVoltages[endpointKey(activePin)] !== undefined
                    ? formatValue(
                        result.pinVoltages[endpointKey(activePin)],
                        "V",
                      )
                    : "Run to measure voltage"}
                </span>
              </div>
            )}
          </div>
        </>
      ) : selectedWire ? (
        <>
          <div className="inspector-identity">
            <Cable size={28} />
            <div>
              <h3>Wire connection</h3>
              <span>Ideal conductor</span>
            </div>
          </div>
          <div className="inspector-section">
            <h4>Endpoints</h4>
            <p>
              {
                circuit.parts.find((p) => p.id === selectedWire.from.part)
                  ?.label
              }
              : {selectedWire.from.pin}
            </p>
            <p>
              {circuit.parts.find((p) => p.id === selectedWire.to.part)?.label}:{" "}
              {selectedWire.to.pin}
            </p>
            <label className="field-label">
              Wire color
              <select
                value={selectedWire.color}
                onChange={(e) =>
                  commit({
                    ...circuit,
                    wires: circuit.wires.map((w) =>
                      w.id === selectedWire.id
                        ? { ...w, color: e.target.value }
                        : w,
                    ),
                  })
                }
              >
                {["coral", "blue", "mint", "amber", "chalk"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button className="button danger" onClick={remove}>
              <Trash2 size={15} />
              Delete wire
            </button>
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <SlidersHorizontal size={30} />
          <h3>Make it your circuit.</h3>
          <p>
            Select a component to edit its properties, or click a wire to
            inspect its connection.
          </p>
        </div>
      )}
      <div className="inspector-foot">
        <Info size={14} />
        <span>
          Ideal DC simulation
          <br />
          Transient & digital models planned
        </span>
      </div>
    </aside>
  );
}
