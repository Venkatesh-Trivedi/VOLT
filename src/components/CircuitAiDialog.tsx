import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { parseCircuit } from "../model/persistence";
import type { Circuit } from "../model/types";

export function CircuitAiDialog({
  onClose,
  onLoad,
}: {
  onClose: () => void;
  onLoad: (circuit: Circuit) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController>(null);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<{
    message: string;
    circuit: Circuit | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    return () => request.current?.abort();
  }, []);

  async function generate() {
    const description = prompt.trim();
    if (!description || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setDraft(null);
    try {
      const response = await fetch("/api/generate-circuit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: description }),
        signal: controller.signal,
      });
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error(
          "Run VOLTAGE with its local development or preview server to use the AI builder.",
        );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Circuit generation failed.");
      setDraft({
        message: data.message,
        circuit:
          data.circuit === null
            ? null
            : parseCircuit(JSON.stringify(data.circuit)),
      });
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Circuit generation failed.",
        );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="help-dialog ai-dialog"
      aria-labelledby="ai-title"
      onClose={onClose}
    >
      <button
        className="help-close icon-button"
        aria-label="Close AI builder"
        onClick={() => dialog.current?.close()}
      >
        <X size={20} />
      </button>
      <h2 id="ai-title">Build with AI</h2>
      <p>
        Describe a DC circuit. OpenAI receives your prompt and returns an
        editable draft.
      </p>
      <form
        className="ai-form"
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
      >
        <label className="field-label">
          Circuit description
          <textarea
            autoFocus
            required
            maxLength={1500}
            rows={4}
            value={prompt}
            disabled={busy}
            onChange={(event) => {
              setPrompt(event.target.value);
              setDraft(null);
              setError("");
            }}
            placeholder="Make a 9 V circuit with two LEDs that turn on together with one switch."
          />
        </label>
        <button className="button primary" disabled={busy || !prompt.trim()}>
          {busy ? "Generating…" : "Generate circuit"}
        </button>
        {busy && <p role="status">Building your circuit draft…</p>}
      </form>
      {error && (
        <p role="alert" className="ai-error">
          {error}
        </p>
      )}
      {draft && (
        <div className="ai-draft" role="status">
          {draft.circuit && <h3>{draft.circuit.name}</h3>}
          <p>{draft.message}</p>
          {draft.circuit && (
            <>
              <p>
                {draft.circuit.parts.length} parts, {draft.circuit.wires.length}{" "}
                wires. Undo restores your previous circuit.
              </p>
              <button
                className="button quiet"
                onClick={() => {
                  if (draft.circuit) onLoad(draft.circuit);
                  dialog.current?.close();
                }}
              >
                Load draft
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
