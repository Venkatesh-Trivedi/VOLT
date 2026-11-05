import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Cpu,
  FilePlus2,
  FolderOpen,
  Lightbulb,
  Play,
  Plus,
  Power,
  Redo2,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Square,
  Undo2,
  X,
  Zap,
  Pause,
  Info,
  CircuitBoard,
  Grip,
  Sparkles,
} from "lucide-react";
import {
  catalog,
  createPart,
  motorAndBuzzerCircuit,
  starterCircuit,
} from "./model/catalog";
import { loadCircuit, parseCircuit, saveCircuit } from "./model/persistence";
import { buildNetlist, simulate } from "./model/solver";
import { useCircuitHistory } from "./model/history";
import { endpointKey } from "./model/types";
import type {
  Category,
  Circuit,
  Endpoint,
  Part,
  Selection,
  Simulation,
} from "./model/types";
import { Workbench } from "./components/Workbench";
import { Inspector } from "./components/Inspector";
import { Help } from "./components/Help";
import { Results } from "./components/Results";
import { LibraryPreview } from "./components/LibraryPreview";
import { BuzzerAudio } from "./components/BuzzerAudio";
import { CircuitAiDialog } from "./components/CircuitAiDialog";
const categories: Category[] = [
  "All parts",
  "Basics",
  "Power",
  "Outputs",
  "Boards",
];
function initialCircuit() {
  try {
    const saved = loadCircuit();
    return { circuit: saved ?? starterCircuit(), saved: !!saved, error: "" };
  } catch {
    return {
      circuit: starterCircuit(),
      saved: false,
      error:
        "Saved circuit could not be read. Your saved data has not been overwritten.",
    };
  }
}
const icons = {
  "All parts": Grip,
  Basics: SlidersHorizontal,
  Power: Power,
  Outputs: Lightbulb,
  Boards: Cpu,
};
export default function App() {
  const [initial] = useState(initialCircuit);
  const { circuit, commit, undo, redo, canUndo, canRedo } = useCircuitHistory(
    initial.circuit,
  );
  const [selection, setSelection] = useState<Selection>({
    type: "part",
    id: initial.circuit.parts.find((p) => p.kind === "resistor")?.id ?? "",
  });
  const [category, setCategory] = useState<Category>(() => {
    const c = new URLSearchParams(location.search).get("category") as Category;
    return categories.includes(c) ? c : "All parts";
  });
  const [search, setSearch] = useState(
    () => new URLSearchParams(location.search).get("q") ?? "",
  );
  const [running, setRunning] = useState(false);
  const [exampleRevision, setExampleRevision] = useState(0);
  const [paused, setPaused] = useState<{
    circuit: Circuit;
    result: Simulation;
  } | null>(null);
  const [wireColor, setWireColor] = useState("coral");
  const [pending, setPending] = useState<Endpoint | null>(null);
  const [activePin, setActivePin] = useState<Endpoint | null>(null);
  const [notice, setNotice] = useState(initial.error);
  const [saved, setSaved] = useState(initial.saved);
  const [help, setHelp] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<"readings" | "diagnostics">(
    "readings",
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const liveResult = useMemo(
    () => (running ? simulate(circuit) : null),
    [running, circuit],
  );
  const result = running
    ? liveResult
    : paused?.circuit === circuit
      ? paused.result
      : null;
  const selectedPart =
    selection?.type === "part"
      ? circuit.parts.find((p) => p.id === selection.id)
      : undefined;
  const selectedWire =
    selection?.type === "wire"
      ? circuit.wires.find((w) => w.id === selection.id)
      : undefined;
  const net = useMemo(() => buildNetlist(circuit), [circuit]);
  useEffect(() => {
    if (mounted.current) setSaved(false);
    else mounted.current = true;
  }, [circuit]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "All parts") params.set("category", category);
    if (search) params.set("q", search);
    history.replaceState(
      null,
      "",
      `${location.pathname}${params.size ? "?" + params : ""}`,
    );
  }, [category, search]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(id);
  }, [notice]);
  function updatePart(p: Part, update: Partial<Part>) {
    commit((c) => ({
      ...c,
      parts: c.parts.map((part) =>
        part.id === p.id ? { ...part, ...update } : part,
      ),
    }));
  }
  function remove() {
    if (!selection) return;
    commit((c) => ({
      ...c,
      parts:
        selection.type === "part"
          ? c.parts.filter((p) => p.id !== selection.id)
          : c.parts,
      wires: c.wires.filter((w) =>
        selection.type === "wire"
          ? w.id !== selection.id
          : w.from.part !== selection.id && w.to.part !== selection.id,
      ),
    }));
    setSelection(null);
    setPending(null);
    setActivePin(null);
  }
  function duplicate() {
    if (!selectedPart) return;
    const p = {
      ...selectedPart,
      ...createPart(
        selectedPart.kind,
        selectedPart.x + 35,
        selectedPart.y + 35,
        circuit.parts,
      ),
      value: selectedPart.value,
      closed: selectedPart.closed,
      rotation: selectedPart.rotation,
      color: selectedPart.color,
    };
    commit({ ...circuit, parts: [...circuit.parts, p] });
    setSelection({ type: "part", id: p.id });
  }
  function rotate() {
    if (selectedPart)
      updatePart(selectedPart, {
        rotation: (selectedPart.rotation + 90) % 360,
      });
  }
  function save() {
    try {
      saveCircuit(circuit);
      setSaved(true);
      setNotice("Circuit saved in this browser.");
    } catch {
      setNotice(
        "Browser storage is unavailable. Export your circuit to keep a copy.",
      );
    }
  }
  function newCircuit() {
    setPaused(null);
    commit({ version: 1, name: "Untitled circuit", parts: [], wires: [] });
    setRunning(false);
    setSelection(null);
    setPending(null);
    setActivePin(null);
  }
  function loadExample(example: Circuit) {
    setPaused(null);
    commit(example);
    setExampleRevision((revision) => revision + 1);
    setRunning(false);
    setSelection(null);
    setPending(null);
    setActivePin(null);
    setNotice(`${example.name} loaded. Undo restores your previous circuit.`);
  }
  function onPin(endpoint: Endpoint) {
    setActivePin(endpoint);
    setSelection({ type: "part", id: endpoint.part });
    if (!pending) {
      setPending(endpoint);
      return;
    }
    if (endpointKey(pending) === endpointKey(endpoint)) {
      setPending(null);
      return;
    }
    const exists = circuit.wires.some(
      (w) =>
        (endpointKey(w.from) === endpointKey(pending) &&
          endpointKey(w.to) === endpointKey(endpoint)) ||
        (endpointKey(w.to) === endpointKey(pending) &&
          endpointKey(w.from) === endpointKey(endpoint)),
    );
    if (!exists)
      commit({
        ...circuit,
        wires: [
          ...circuit.wires,
          {
            id: crypto.randomUUID(),
            from: pending,
            to: endpoint,
            color: wireColor,
          },
        ],
      });
    setPending(null);
  }
  function toggle(id: string, closed?: boolean) {
    const p = circuit.parts.find((p) => p.id === id);
    if (p) updatePart(p, { closed: closed ?? !p.closed });
  }
  function exportCircuit() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(circuit, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${circuit.name.replace(/[^a-z0-9-]/gi, "-") || "circuit"}.voltage.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importCircuit(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2000000)
        throw new Error("File is too large (maximum 2 MB).");
      const next = parseCircuit(await file.text());
      setPaused(null);
      commit(next);
      setRunning(false);
      setSelection(null);
      setPending(null);
      setActivePin(null);
      setNotice("Circuit imported. Save to keep it in this browser.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not import circuit.");
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (aiOpen) return;
      if (help) {
        if (e.key === "Escape") setHelp(false);
        return;
      }
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        setPending(null);
        setHelp(false);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (e.key.toLowerCase() === "r" && !mod) rotate();
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setPending(null);
        setActivePin(null);
        if (e.shiftKey) redo();
        else undo();
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        setPending(null);
        setActivePin(null);
        redo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const filtered = catalog.filter(
    (c) =>
      (category === "All parts" || c.category === category) &&
      `${c.name} ${c.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedReading =
    selectedPart && result?.valid
      ? result.readings[selectedPart.id]
      : undefined;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Voltage electronics lab"
        >
          <span className="brand-mark">
            <Zap size={22} fill="currentColor" />
          </span>
          <span>
            Voltage<span className="brand-sub">Electronics lab</span>
          </span>
        </a>
        <span className="header-rule" />
        <div className="project-path">
          <FolderOpen size={15} />
          <span>My workspace</span>
          <span className="slash">/</span>
          <strong>{circuit.name}</strong>
          <ChevronDown size={13} />
        </div>
        <div className="header-actions">
          <span className={`save-state ${saved ? "is-saved" : ""}`}>
            {saved ? <Check size={13} /> : <Square size={10} />}
            <span>{saved ? "Saved locally" : "Unsaved changes"}</span>
          </span>
          <button
            className="icon-button"
            title="How to use Voltage"
            aria-label="Help"
            onClick={() => setHelp((h) => !h)}
          >
            <CircleHelp size={19} />
          </button>
          <button className="button quiet save-button" onClick={save}>
            <Save size={15} />
            Save project
          </button>
        </div>
      </header>
      <div className="project-bar">
        <div className="project-title">
          <CircuitBoard size={20} />
          <input
            aria-label="Circuit name"
            maxLength={100}
            value={circuit.name}
            onChange={(e) => commit({ ...circuit, name: e.target.value })}
          />
          <span className="version-tag">DC workbench</span>
        </div>
        <div className="project-tools">
          <button className="button quiet" onClick={() => setAiOpen(true)}>
            <Sparkles size={16} />
            Build with AI
          </button>
          <button
            className="icon-button"
            aria-label="New circuit"
            title="New blank circuit (undoable)"
            onClick={newCircuit}
          >
            <FilePlus2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Import circuit"
            title="Import circuit JSON"
            onClick={() => fileInput.current?.click()}
          >
            <ArrowUpFromLine size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Export circuit"
            title="Export circuit JSON"
            onClick={exportCircuit}
          >
            <ArrowDownToLine size={17} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="icon-button"
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            onClick={() => {
              undo();
              setPending(null);
            }}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            onClick={() => {
              redo();
              setPending(null);
            }}
          >
            <Redo2 size={18} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="icon-button"
            title="Reset simulation; keeps circuit"
            aria-label="Reset simulation"
            onClick={() => {
              setPaused(null);
              setRunning(false);
              setPending(null);
              setNotice("Simulation reset. Your circuit is unchanged.");
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button
            className={`button primary run-button ${running ? "running" : ""}`}
            onClick={() => {
              if (running && result) setPaused({ circuit, result });
              else setPaused(null);
              setRunning((v) => !v);
            }}
          >
            {running ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            {running ? "Pause" : "Run simulation"}
          </button>
          {circuit.parts.some((p) => p.kind === "buzzer") && (
            <BuzzerAudio
              buzzing={
                !!liveResult?.valid &&
                Object.values(liveResult.readings).some(
                  (reading) => reading.buzzing,
                )
              }
              onError={setNotice}
            />
          )}
        </div>
      </div>
      <main className="studio-layout">
        <aside className="library-panel" aria-label="Component library">
          <div className="panel-heading">
            <h2>Components</h2>
            <span className="count">{catalog.length}</span>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input
              placeholder="Search components…"
              aria-label="Search components"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={12} />
              </button>
            )}
          </label>
          <div className="categories">
            {categories.map((c) => {
              const Icon = icons[c];
              return (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  <Icon size={15} />
                  {c}
                  <span>
                    {
                      catalog.filter(
                        (p) => c === "All parts" || p.category === c,
                      ).length
                    }
                  </span>
                </button>
              );
            })}
          </div>
          <div className="library-section">
            <span>
              {category === "All parts" ? "Component library" : category}
            </span>
            <span>Drag to add</span>
          </div>
          <div className="component-grid">
            {filtered.map((m) => (
              <button
                key={m.kind}
                className={`component-card ${!m.supported ? "planned-part" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/voltage-part", m.kind);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => {
                  const p = createPart(
                    m.kind,
                    220 + (circuit.parts.length % 4) * 50,
                    80 + (circuit.parts.length % 3) * 70,
                    circuit.parts,
                  );
                  commit({ ...circuit, parts: [...circuit.parts, p] });
                  setSelection({ type: "part", id: p.id });
                }}
                title={`${m.description}${m.supported ? "" : " — placement only; not simulated"}`}
              >
                <span className="component-preview">
                  <LibraryPreview kind={m.kind} />
                </span>
                <span className="component-name">{m.name}</span>
                <span className="component-sub">
                  {m.supported
                    ? m.unit
                      ? `${m.value} ${m.unit}`
                      : "DC ready"
                    : "Model planned"}
                </span>
                <Plus size={12} className="add-part" />
              </button>
            ))}
          </div>
          {!filtered.length && (
            <div className="library-empty">
              No matching parts.
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("All parts");
                }}
              >
                Show all components
              </button>
            </div>
          )}
          <div className="library-footer">
            <BookOpen size={17} />
            <div>
              <strong>Learn by building</strong>
              <button onClick={() => loadExample(starterCircuit())}>
                Load LED example
              </button>
              <button onClick={() => loadExample(motorAndBuzzerCircuit())}>
                Load Spin and buzz
              </button>
            </div>
          </div>
        </aside>
        <div className="center-panel">
          <Workbench
            key={exampleRevision}
            circuit={circuit}
            commit={commit}
            selection={selection}
            select={setSelection}
            result={result}
            running={running}
            wireColor={wireColor}
            setWireColor={setWireColor}
            pending={pending}
            setPending={setPending}
            onPin={onPin}
            onRemove={remove}
            onDuplicate={duplicate}
            onRotate={rotate}
            onToggle={toggle}
            activePin={activePin}
            net={net}
          />
          <Results
            circuit={circuit}
            result={result}
            running={running}
            bottomTab={bottomTab}
            setBottomTab={setBottomTab}
          />
        </div>
        <Inspector
          selectedPart={selectedPart}
          selectedWire={selectedWire}
          selectedReading={selectedReading}
          updatePart={updatePart}
          toggle={toggle}
          circuit={circuit}
          net={net}
          activePin={activePin}
          result={result}
          onPin={onPin}
          commit={commit}
          remove={remove}
          setNotice={setNotice}
        />
      </main>
      <footer className="statusbar">
        <div>
          <CircuitBoard size={13} />
          {circuit.parts.length} components
          <span className="status-separator" />
          {circuit.wires.length} wires
        </div>
        <span>
          Local workspace
          <span className="status-separator" />
          Milestone 1 + DC foundations
        </span>
        <button onClick={() => setHelp((h) => !h)}>
          Keyboard shortcuts <span>?</span>
        </button>
      </footer>
      {notice && (
        <div role="status" className="toast">
          <Info size={17} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {help && <Help onClose={() => setHelp(false)} />}
      {aiOpen && (
        <CircuitAiDialog
          onClose={() => setAiOpen(false)}
          onLoad={loadExample}
        />
      )}
      <input
        ref={fileInput}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          void importCircuit(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
