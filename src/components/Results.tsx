import { Activity, AlertTriangle, Check, Info, Play } from "lucide-react";
import type { Circuit, Simulation } from "../model/types";
import { formatValue } from "../model/persistence";
type Props = {
  circuit: Circuit;
  result: Simulation | null;
  running: boolean;
  bottomTab: "readings" | "diagnostics";
  setBottomTab: (tab: "readings" | "diagnostics") => void;
};
export function Results({
  circuit,
  result,
  running,
  bottomTab,
  setBottomTab,
}: Props) {
  const errors = result?.diagnostics.filter((d) => d.level !== "info") ?? [];
  const supplied = result?.valid ? result.sourcePower : undefined;
  return (
    <section className="results-panel" aria-label="Simulation results">
      <div className="results-tabs">
        <button
          className={bottomTab === "readings" ? "active" : ""}
          onClick={() => setBottomTab("readings")}
        >
          <Activity size={15} />
          Live readings
        </button>
        <button
          className={bottomTab === "diagnostics" ? "active" : ""}
          onClick={() => setBottomTab("diagnostics")}
        >
          <Info size={14} />
          Diagnostics
          {errors.length > 0 && (
            <span className="diagnostic-count">{errors.length}</span>
          )}
        </button>
        <span className="results-status">
          {running
            ? result?.valid
              ? "DC steady state"
              : "Check circuit"
            : "Simulation paused"}
        </span>
      </div>
      {bottomTab === "readings" ? (
        <div className="readings-content">
          <div className="measurement">
            <span>Source voltage</span>
            <strong>
              {result?.valid &&
              circuit.parts.some(
                (p) => p.kind === "battery" || p.kind === "supply",
              )
                ? formatValue(
                    result.readings[
                      circuit.parts.find(
                        (p) => p.kind === "battery" || p.kind === "supply",
                      )!.id
                    ]?.voltage ?? NaN,
                    "V",
                  )
                : "—"}
              <span className="measurement-caption">
                {circuit.parts.find(
                  (p) => p.kind === "battery" || p.kind === "supply",
                )?.label ?? "No source"}
              </span>
            </strong>
          </div>
          <div className="measurement">
            <span>Source current</span>
            <strong>
              {result?.valid
                ? formatValue(
                    Math.abs(
                      result.readings[
                        circuit.parts.find(
                          (p) => p.kind === "battery" || p.kind === "supply",
                        )?.id ?? ""
                      ]?.current ?? NaN,
                    ),
                    "A",
                  )
                : "—"}
            </strong>
          </div>
          <div className="measurement">
            <span>Delivered power</span>
            <strong>
              {supplied !== undefined ? formatValue(supplied, "W") : "—"}
            </strong>
          </div>
          <div className="reading-note">
            {!running ? (
              <>
                <Play size={18} />
                <span>
                  {result ? "Analysis paused." : "Ready when you are."}
                  <br />
                  {result
                    ? "Showing the last solved readings."
                    : "Run your circuit to see real readings."}
                </span>
              </>
            ) : !result?.valid ? (
              <>
                <AlertTriangle size={18} />
                <span>
                  Check diagnostics.
                  <br />
                  The circuit could not be solved.
                </span>
              </>
            ) : (
              <>
                <Activity size={18} />
                <span>
                  {result.nodes} electrical nodes
                  <br />
                  {errors.length
                    ? `${errors.length} circuit warning${errors.length > 1 ? "s" : ""}`
                    : "Circuit solved successfully"}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="diagnostics-list">
          {result ? (
            result.diagnostics.length ? (
              result.diagnostics.map((d, i) => (
                <div key={i} className={`diagnostic ${d.level}`}>
                  {d.level === "info" ? (
                    <Info size={14} />
                  ) : (
                    <AlertTriangle size={14} />
                  )}
                  <span>{d.message}</span>
                </div>
              ))
            ) : (
              <div className="diagnostic">
                <Check size={14} />
                No circuit diagnostics.
              </div>
            )
          ) : (
            <div className="diagnostic">
              <Info size={14} />
              Run the simulation to check connections and component limits.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
