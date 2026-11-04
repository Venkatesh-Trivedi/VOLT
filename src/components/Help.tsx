import { X, Zap } from "lucide-react";
export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-backdrop" onClick={() => onClose()}>
      <section
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const elements = e.currentTarget.querySelectorAll<HTMLElement>(
              'button,[href],input,select,[tabindex="0"]',
            );
            const first = elements[0],
              last = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="help-close icon-button"
          autoFocus
          aria-label="Close help"
          onClick={() => onClose()}
        >
          <X size={20} />
        </button>
        <span className="help-mark">
          <Zap size={28} />
        </span>
        <h2 id="help-title">A little curiosity. A live circuit.</h2>
        <p>
          Place parts anywhere. Click a pin, then another pin to create an
          electrical connection. Drop a component pin onto a breadboard hole to
          snap and connect it.
        </p>
        <dl>
          <div>
            <dt>Move a component</dt>
            <dd>Drag its body</dd>
          </div>
          <div>
            <dt>Rotate selected part</dt>
            <dd>R</dd>
          </div>
          <div>
            <dt>Duplicate selected part</dt>
            <dd>Ctrl / ⌘ + D</dd>
          </div>
          <div>
            <dt>Remove selection</dt>
            <dd>Delete</dd>
          </div>
          <div>
            <dt>Undo / redo</dt>
            <dd>Ctrl / ⌘ + Z / Shift + Z</dd>
          </div>
          <div>
            <dt>Save locally</dt>
            <dd>Ctrl / ⌘ + S</dd>
          </div>
          <div>
            <dt>Zoom / pan</dt>
            <dd>Scroll / drag empty space</dd>
          </div>
          <div>
            <dt>Cancel a wire</dt>
            <dd>Esc</dd>
          </div>
        </dl>
        <p className="help-limit">
          DC resistors, sources, ideal switches, and simplified diodes are
          modeled. Planned parts have open pins. Voltmeters measure within one
          electrical island. Reset clears analysis, and New creates an undoable
          blank circuit.
        </p>
        <button className="button primary" onClick={() => onClose()}>
          Back to the workbench
        </button>
      </section>
    </div>
  );
}
