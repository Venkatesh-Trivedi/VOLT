# VOLTAGE

A browser-based electronics workbench. Place and wire individual components freely; the DC solver uses the actual pin connections and breadboard contacts.

## Run locally

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

```sh
npm test
npm run build
npm run preview
```

## Working with a circuit

- Drag a part from the searchable library onto the bench. Select it to edit its properties, rotate, duplicate, or delete it.
- Click one pin, then another to create a wire. Choose its color in the wiring controls. Select a wire to inspect or delete it.
- Move parts freely; attached wire endpoints follow their pins. Use the canvas navigation controls to zoom and pan.
- Run solves the current circuit. Pause freezes the readings; reset clears the simulation. Changing wiring or component values changes the electrical network.
- Save stores the circuit in this browser. Export and import JSON to keep a portable copy. Project files contain the actual components, pin connections, and wire colors.
- Undo and redo restore edits. The initial circuit is an editable example; create a new project for an empty workbench.

Shortcuts: **R** rotates the selected part, **Delete** removes the selection, **Ctrl/Cmd+D** duplicates, **Ctrl/Cmd+Z** undoes, **Ctrl/Cmd+Shift+Z** redoes, **Ctrl/Cmd+S** saves, and **Escape** cancels a pending wire. Drag empty workspace or use the hand tool to pan; use the mouse wheel or zoom controls to zoom.

Dropping a component pin near a breadboard hole snaps that contact and creates a visible electrical connection. Other leads exactly aligned with board holes also connect; wire unaligned leads explicitly. Mechanical collisions and lead deformation are not modeled. Select a hole to highlight the contacts sharing its electrical node.

## Electrical model and limits

The engine builds a union-find netlist from wires, breadboard groups, and closed ideal switches, then solves DC modified nodal equations with pivoted elimination. Resistors and ideal DC voltage sources obey Kirchhoff's laws. Each isolated electrical island needs a separate voltage reference; source negative is used when no ground is connected.

The miniature breadboard has 25 columns. Holes a-e in each column form one terminal strip, f-j form a separate strip, and the center gap is electrically open. Each of the four power rails is continuous and independent: this board does **not** have a midpoint rail break. Crossing wires do not connect unless their endpoints share a contact.

LEDs use a simplified piecewise DC model: a configured forward voltage followed by 10 ohms of dynamic resistance. An iterative operating-point solve determines conduction and illumination. Reverse leakage, reverse breakdown, temperature, transient behavior, and damage are not simulated. Overcurrent is a warning, not a physical destruction model. Color does not imply a particular physical forward voltage; configure the forward voltage for the intended LED.

Voltage, current, and power readings are computed from the solved network. Absolute node voltages on different isolated islands cannot be compared. Ideal shorts across voltage sources and conflicting/redundant source constraints stop the solve with a diagnostic. Open circuits draw no meaningful source current. The simulation is DC and has no time-domain waveform.

Parts labeled unsupported or planned have no working electrical model. They must not be treated as simulated devices. In particular, microcontroller firmware execution, digital peripherals, capacitor transients, motor dynamics, and buzzer audio are not implemented. No Arduino or ESP32 emulation is claimed.

The voltmeter is an ideal differential DC voltage probe. An ammeter/ohmmeter mode and inferred current through an ideal closed switch are not implemented. Component resistance is editable; branch current and power are available for the modeled resistive and diode devices. Potentiometer wipers, capacitor transients, motors, buzzers, and logic gates remain placement-only. Future work includes ESP32, sensors, servos, displays, relays, transistors, and firmware integration after the core milestones.

Browser storage can be cleared or unavailable. Export important projects to JSON. This educational model is not a substitute for device datasheets or hardware verification.

## Source organization

- `src/model/`: component definitions, electrical topology, solver, project validation and persistence.
- Editor and rendering modules in `src/`: placement, SVG components, connections, properties, and instruments.
- `tests/`: automated connectivity, numerical, and persistence checks.

The design follows Hallmark's Console app-screen direction: graphite surfaces, amber operator actions, and blue instrumentation. No backend, account, or network service is needed to save a circuit locally.

## Verified milestone

On November 4, 2026, `npm test` passed 19 tests, including all ten requested numerical, connectivity, and save/load scenarios; `npm run build` passed TypeScript checking and the production bundle build.

Chrome browser walkthroughs verified assembly from a blank canvas, pin wiring and calculated current, live switches, pause/reset, wire deletion and undo/redo, save/reload, library drag/drop, free component movement, keyboard rotation and duplication/deletion, zoom/pan, and breadboard node highlighting. Hallmark's final responsive render checks reported zero failures and zero warnings, with one documented exception for large draggable component buttons and two answered consistency checks.

Delivered scope: Milestone 1, DC simulation foundations, and working breadboard/LED/voltmeter features. Full transient simulation, firmware emulation, 3D inspection, motor animation, arbitrary editable wire bends, and multimeter current/resistance modes remain planned. Wires use automatic orthogonal paths. Ideal-wire current-flow animations are deliberately absent because the current through an arbitrary ideal-wire network is not determined by this solver.
