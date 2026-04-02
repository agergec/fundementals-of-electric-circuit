# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CircuitLab — an interactive electric circuit simulator for pre-lycée students (ages 10-14). Single-page app where students build series/parallel circuits and see real-time Ohm's law calculations.

## Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server (http://localhost:5173)
npm run build        # production build → dist/
npm run preview      # preview production build locally
```

## Architecture

```
UI (React SVG) → State (Zustand store) → Engine (pure functions)
```

- **Engine** (`src/engine/`): Pure recursive circuit solver. Tree data model with `SeriesNode`, `ParallelNode`, `ComponentNode`. Two-pass algorithm: bottom-up resistance calculation, top-down voltage/current distribution.
- **Store** (`src/store/circuitStore.ts`): Zustand store holding circuit tree, voltage, switch state. Calls `solveCircuit()` on every mutation.
- **Components** (`src/components/`): SVG-based rendering. `CircuitWorkspace` does recursive layout from the tree. Element components (`Lamp`, `Ammeter`, etc.) render individual SVG graphics.

## Key Design Decisions

- **Structured builder, not free-form**: Students add components via the toolbar. Wires are automatic. Every circuit is always valid.
- **Voltmeters** are not in the resistance tree — they read voltage from the component they measure across.
- **Ammeters** have 0Ω resistance (ideal). **Switches** have 0Ω closed, ∞Ω open.
- Layout is deterministic from tree structure (series = horizontal, parallel = vertical branching).

## Tech Stack

React 19, TypeScript, Vite, Zustand, Tailwind CSS v4, Framer Motion, Lucide icons. Deployed as static files to GitHub Pages.
