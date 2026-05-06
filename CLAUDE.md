# CLAUDE.md

CircuitLab — an interactive electric circuit simulator for pre-lycée students (ages 10-14).

## Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server (http://localhost:5173)
npm run build        # production build → dist/
npm run lint         # ESLint check
npm run test         # vitest (27 tests)
npm run test:watch   # vitest in watch mode
npm run preview      # preview production build
```

## Architecture

```
UI (React SVG) → State (Zustand stores) → Engine (pure functions)
```

Two modes: **Structured** (tree-based) and **Free Design** (graph-based).

### Structured Mode
- **Engine** (`src/engine/`): Recursive tree solver. `SeriesNode`, `ParallelNode`, `ComponentNode`. Two-pass: `calcResistance` (bottom-up), `distribute` (top-down).
- **Store** (`src/store/circuitStore.ts`): Tree state, mutations, calls `solveCircuit()`.
- **UI** (`src/components/circuit/CircuitWorkspace.tsx`): Recursive SVG layout from tree.

### Free Design Mode
- **Engine** (`src/engine/freeMode/`): 
  - `graph.ts` — Union-Find terminal merging, builds electrical node graph
  - `topology.ts` — Series-parallel graph reduction to tree
  - `solver.ts` — Orchestrates graph→tree→solve, polarity propagation
  - `mna.ts` — Modified Nodal Analysis (Gaussian elimination) for non-series-parallel circuits
  - `validate.ts` — Detects shorts, ammeter-in-parallel, voltmeter-in-series, blown fuses
  - `importTree.ts` — Converts structured tree to free-mode components+wires
- **Store** (`src/store/freeModeStore.ts`): Components, wires, tools, undo/redo (50 steps), save/load (localStorage)
- **Store** (`src/store/modeStore.ts`): Toggle between structured/free
- **Store** (`src/store/challengeStore.ts`): Random target resistance, star rating
- **UI** (`src/components/freeMode/`):
  - `FreeCanvas.tsx` — Main SVG canvas with pan/zoom, drag-drop, wiring
  - `FreeComponent.tsx` — Renders placed components with terminal dots, drag area
  - `FreeWire.tsx` — Bezier/straight/corner wire rendering with heat coloring
  - `WireDrawingLayer.tsx` — Active wire preview
  - `BreadboardGrid.tsx` — Breadboard hole grid overlay
  - `ChallengePanel.tsx` — Challenge mode UI

### Shared Elements (`src/components/elements/`)
Generator(G), Lamp, Ammeter(A), Voltmeter(V), Switch, Resistor(Ω), Fuse(~). All 64×64, connectors at ±40, snap to 40px grid.

## Key Design Decisions
- **Ammeter/Fuse**: 0Ω (closed switch: 0Ω, open: ∞Ω)
- **Voltmeter**: ∞Ω (not in resistance tree)
- **Fuse**: 0Ω until current > rating → blown (∞Ω). Rating selectable (0.5-5A)
- **Multiple generators**: MNA solver handles 2+ generators with per-generator voltage
- **Polarity**: Dynamically computed from generator connections, propagated through components
- **Wire resistance**: Only added when toolbar toggle is enabled
- **Terminal size**: Connector dots at r=6, hit area r=10-16
- **Grid**: 40px snap, components at grid positions align terminals with breadboard holes

## Component Types
`lamp | ammeter | voltmeter | switch | generator | junction | resistor | fuse`

## Testing
27 vitest tests in `src/engine/__tests__/`:
- `solver.test.ts` — Structured solver (series, parallel, open, short, meters)
- `freeMode.test.ts` — Graph building, SP reduction, MNA fallback, multi-generator
- `validate.test.ts` — Ammeter/voltmeter placement, short circuit, generator off

## Tech Stack
React 19, TypeScript, Vite, Zustand, Tailwind CSS v4, Lucide icons, Vitest.
