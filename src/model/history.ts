import { useCallback, useState } from "react";
import type { Circuit } from "./types";
export function useCircuitHistory(initial: Circuit) {
  const [state, setState] = useState({
    past: [] as Circuit[],
    present: initial,
    future: [] as Circuit[],
  });
  const commit = useCallback(
    (next: Circuit | ((current: Circuit) => Circuit)) =>
      setState((s) => {
        const present = typeof next === "function" ? next(s.present) : next;
        if (present === s.present) return s;
        return { past: [...s.past.slice(-99), s.present], present, future: [] };
      }),
    [],
  );
  const undo = useCallback(
    () =>
      setState((s) =>
        s.past.length
          ? {
              past: s.past.slice(0, -1),
              present: s.past.at(-1)!,
              future: [s.present, ...s.future],
            }
          : s,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setState((s) =>
        s.future.length
          ? {
              past: [...s.past, s.present],
              present: s.future[0],
              future: s.future.slice(1),
            }
          : s,
      ),
    [],
  );
  return {
    circuit: state.present,
    commit,
    undo,
    redo,
    canUndo: !!state.past.length,
    canRedo: !!state.future.length,
  };
}
