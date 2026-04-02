# CircuitLab ⚡

An interactive electric circuit simulator for pre-lycée students (ages 10–14). Build series and parallel circuits, add components, and watch Ohm's law come to life in real time.

**Live demo:** https://agergec.github.io/fundementals-of-electric-circuit/

---

## What You Can Do

- **Build circuits** — Add lamps, switches, amperemeters, and voltmeters to a circuit loop
- **Series & parallel** — Place components in series, or split any branch into parallel paths
- **Control voltage** — Drag the generator slider (0–24 V) and see all values update instantly
- **Adjust resistance** — Change each lamp's resistance independently (R/3, R/2, R, 2R, 3R, 4R)
- **Toggle switches** — Double-click a switch to open/close it; each switch acts independently
- **Read measurements** — Voltage (V), current (A), and resistance (Ω) shown on every component
- **Spot problems** — Short circuit and open circuit warnings appear automatically with explanations

---

## Components

| Component | Symbol | Behaviour |
|---|---|---|
| Generator | Battery icon | Configurable voltage source (0–24 V) |
| Lamp | Bulb (glows brighter with more current) | Resistor with visual feedback |
| Switch | Toggle arm | Click to select, double-click to open/close |
| Amperemeter | **A** circle | Ideal — 0 Ω, placed in series |
| Voltmeter | **V** circle | Ideal — ∞ Ω, placed in parallel |

---

## How to Use

### Adding components
1. Use the **toolbar** on the left to add a Lamp, Switch, Amperemeter, or Voltmeter
2. **Click a component** to select it — the info panel appears bottom-right
3. With a component selected, clicking **Lamp** adds a new lamp in series right next to it
4. With a component selected, clicking **Add Amperemeter** places it in series after the selection
5. With a component selected, clicking **Add Voltmeter** places it in parallel across the selection

### Parallel branches
1. Select any lamp
2. Click **Add Parallel Branch** — the lamp splits into two parallel paths
3. Repeat to add more branches to the same parallel group

### Switches
- **Single click** — select (shows info panel with toggle button and remove option)
- **Double click** — toggle open/closed directly on the circuit
- Each switch is independent — opening one branch doesn't affect others

### Removing components
1. Click the component to select it
2. Click **Remove** in the info panel

---

## Circuit Rules (Physics)

- **Amperemeter in series**: 0 Ω — must never be placed in parallel (causes short circuit)
- **Voltmeter in parallel**: ∞ Ω — must never be placed in series (causes open circuit)
- **Series**: same current through all components, voltage divides by resistance
- **Parallel**: same voltage across all branches, current divides inversely by resistance

---

## Development

```bash
npm install       # install dependencies
npm run dev       # start dev server → http://localhost:5173
npm run build     # production build → dist/
```

**Tech stack:** React 19, TypeScript, Vite, Zustand, Tailwind CSS v4, Framer Motion

Deployed automatically to GitHub Pages on every push to `main` via GitHub Actions.

---

## Contributors

| | Username |
|---|---|
| <img src="https://avatars.githubusercontent.com/u/1389848?v=4" width="40" height="40" style="border-radius:50%"> | [@agergec](https://github.com/agergec) |
