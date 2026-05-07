import { describe, it, expect } from 'vitest';
import {
  routeOrthogonal,
  buildRoundedPath,
  buildPointList,
  pathLength,
  computeFacing,
} from '../freeMode/router';

describe('computeFacing', () => {
  it('returns R when terminal is right of center', () => {
    expect(computeFacing(140, 100, 100, 100)).toBe('R');
  });

  it('returns L when terminal is left of center', () => {
    expect(computeFacing(60, 100, 100, 100)).toBe('L');
  });

  it('returns D when terminal is below center (vertical dominant)', () => {
    expect(computeFacing(100, 140, 100, 100)).toBe('D');
  });

  it('returns U when terminal is above center (vertical dominant)', () => {
    expect(computeFacing(100, 60, 100, 100)).toBe('U');
  });
});

describe('routeOrthogonal', () => {
  it('returns detour C-shape for same-row opposite-facing (always right-angle)', () => {
    // Terminal 1 at (120,100) exits RIGHT. Terminal 2 at (200,100) exits LEFT.
    const wp = routeOrthogonal({ x: 120, y: 100 }, 'R', { x: 200, y: 100 }, 'L');
    // Same row: creates detour above. e1=(140,100), e2=(180,100), detourY=70
    expect(wp).toHaveLength(2);
    expect(wp[0]).toEqual({ x: 140, y: 70 });
    expect(wp[1]).toEqual({ x: 180, y: 70 });
  });

  it('returns L-shape (1 bend) for mixed axes', () => {
    // Terminal 1 at (120,100) exits RIGHT. Terminal 2 at (200,200) exits DOWN.
    const wp = routeOrthogonal({ x: 120, y: 100 }, 'R', { x: 200, y: 200 }, 'D');
    expect(wp).toHaveLength(1);
    // Bend at intersection: (e2.x, e1.y) = (220, 100)
    // Actually t2=(200,200), d2=D, so e2=(200,220). t1=(120,100), d1=R, e1=(140,100)
    // h1=true, h2=false. Bend = (e2.x, e1.y) = (200, 100). After cleanup: [t1, bend, t2] → waypoint=[bend]
    expect(wp[0].x).toBe(200);
    expect(wp[0].y).toBe(100);
  });

  it('returns L-shape for vertical-then-horizontal', () => {
    const wp = routeOrthogonal({ x: 120, y: 100 }, 'D', { x: 200, y: 200 }, 'L');
    expect(wp).toHaveLength(1);
    // d1 vertical, d2 horizontal → bend = (e1.x, e2.y)
    // t1(120,100), d1=D → e1=(120,120). t2(200,200), d2=L → e2=(180,200)
    // bend = (e1.x, e2.y) = (120, 200)
    expect(wp[0].x).toBe(120);
    expect(wp[0].y).toBe(200);
  });

  it('returns C-shape (2 bends) for same direction on same axis', () => {
    // Both exit RIGHT
    const wp = routeOrthogonal({ x: 100, y: 100 }, 'R', { x: 200, y: 200 }, 'R');
    expect(wp).toHaveLength(2);
    // Different rows → midpoint connector
    // e1=(120,100), e2=(220,200). mx=170. bends: (170,100), (170,200)
    expect(wp[0].x).toBe(170);
    expect(wp[0].y).toBe(100);
    expect(wp[1].x).toBe(170);
    expect(wp[1].y).toBe(200);
  });

  it('returns detour C-shape for same row, facing away', () => {
    // t1 right of t2, both exiting away from each other
    const wp = routeOrthogonal({ x: 200, y: 100 }, 'R', { x: 100, y: 100 }, 'L');
    expect(wp).toHaveLength(2);
    // Same row: detour above. e1=(220,100), e2=(80,100), detourY=70
    expect(wp[0].x).toBe(220);
    expect(wp[0].y).toBe(70);
    expect(wp[1].x).toBe(80);
    expect(wp[1].y).toBe(70);
  });

  it('handles both vertical, facing each other', () => {
    const wp = routeOrthogonal({ x: 100, y: 120 }, 'D', { x: 100, y: 200 }, 'U');
    // Same col: always detour. e1=(100,140), e2=(100,180), detourX=70
    expect(wp).toHaveLength(2);
    expect(wp[0]).toEqual({ x: 70, y: 140 });
    expect(wp[1]).toEqual({ x: 70, y: 180 });
  });

  it('handles both vertical, different cols', () => {
    const wp = routeOrthogonal({ x: 100, y: 120 }, 'D', { x: 200, y: 200 }, 'U');
    expect(wp).toHaveLength(2);
    // Vertical, different cols → horizontal connector at midpoint
    // e1=(100,140), e2=(200,180). my=160. bends: (100,160), (200,160)
    expect(wp[0].x).toBe(100);
    expect(wp[0].y).toBe(160);
    expect(wp[1].x).toBe(200);
    expect(wp[1].y).toBe(160);
  });

  it('handles both vertical, same col, facing away', () => {
    const wp = routeOrthogonal({ x: 100, y: 200 }, 'D', { x: 100, y: 120 }, 'U');
    expect(wp).toHaveLength(2);
    // Same col: detour left. e1=(100,220), e2=(100,100), detourX=70
    expect(wp[0].x).toBe(70);
    expect(wp[0].y).toBe(220);
    expect(wp[1].x).toBe(70);
    expect(wp[1].y).toBe(100);
  });
});

describe('buildRoundedPath', () => {
  it('returns straight line for two points', () => {
    const d = buildRoundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(d).toBe('M 0 0 L 100 0');
  });

  it('returns empty for empty array', () => {
    expect(buildRoundedPath([])).toBe('');
  });

  it('returns empty for single point', () => {
    expect(buildRoundedPath([{ x: 0, y: 0 }])).toBe('');
  });

  it('includes arc commands for 3 points (L-shape)', () => {
    const d = buildRoundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    expect(d).toContain('M 0 0');
    expect(d).toContain('A'); // arc rounding at the corner
    expect(d).toContain('L 100 100'); // final segment
  });

  it('includes arcs for C-shape (4 points)', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ];
    const d = buildRoundedPath(pts);
    expect(d).toContain('M 0 0');
    // Should have 2 arc commands (bends at (50,0) and (50,50))
    const arcs = d.match(/A/g);
    expect(arcs).not.toBeNull();
    expect(arcs!.length).toBe(2);
  });
});

describe('buildPointList', () => {
  it('returns terminal + detour + terminal for same-row auto-route', () => {
    const pts = buildPointList({ x: 120, y: 100 }, 'R', { x: 200, y: 100 }, 'L', []);
    // Same row: auto-routed detour → [t1, detour1, detour2, t2]
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 120, y: 100 });
    expect(pts[3]).toEqual({ x: 200, y: 100 });
  });

  it('returns terminal + waypoints + terminal when waypoints provided', () => {
    const wp = [{ x: 150, y: 80 }, { x: 180, y: 80 }];
    const pts = buildPointList({ x: 120, y: 100 }, 'R', { x: 200, y: 100 }, 'L', wp);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 120, y: 100 });
    expect(pts[1]).toEqual({ x: 150, y: 80 });
    expect(pts[2]).toEqual({ x: 180, y: 80 });
    expect(pts[3]).toEqual({ x: 200, y: 100 });
  });

  it('auto-routes when waypoints are empty', () => {
    const pts = buildPointList({ x: 100, y: 100 }, 'R', { x: 200, y: 200 }, 'L', []);
    // Should have more than 2 points (bend in between)
    expect(pts.length).toBeGreaterThan(2);
  });
});

describe('pathLength', () => {
  it('computes straight horizontal length', () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(100);
  });

  it('computes L-shape length', () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])).toBe(200);
  });

  it('returns 0 for single point', () => {
    expect(pathLength([{ x: 0, y: 0 }])).toBe(0);
  });

  it('computes diagonal length', () => {
    const len = pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
    expect(len).toBeCloseTo(5);
  });
});
