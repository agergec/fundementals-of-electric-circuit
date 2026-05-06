export type Facing = 'L' | 'R' | 'U' | 'D';

export interface Point {
  x: number;
  y: number;
}

const DIR: Record<Facing, Point> = {
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
};

/** Determine which direction a terminal faces, given the component center. */
export function computeFacing(tx: number, ty: number, cx: number, cy: number): Facing {
  if (Math.abs(tx - cx) >= Math.abs(ty - cy)) return tx < cx ? 'L' : 'R';
  return ty < cy ? 'U' : 'D';
}

function isHorizontal(d: Facing): boolean {
  return d === 'L' || d === 'R';
}

function extend(p: Point, d: Facing, jetty: number): Point {
  return { x: p.x + DIR[d].x * jetty, y: p.y + DIR[d].y * jetty };
}

/**
 * Remove redundant collinear intermediate points.
 */
function cleanupCollinear(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts;
  const result = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    // Check if (prev, curr, next) are collinear within 1px tolerance
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (Math.abs(cross) > 1) {
      result.push(curr);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

/**
 * Generate intermediate waypoints for an orthogonal wire between two terminals.
 * Returns empty array for straight paths; 1 point for L-shapes; 2 points for C-shapes.
 */
export function routeOrthogonal(
  t1: Point,
  d1: Facing,
  t2: Point,
  d2: Facing,
  jetty: number = 20,
): Point[] {
  const e1 = extend(t1, d1, jetty);
  const e2 = extend(t2, d2, jetty);
  const h1 = isHorizontal(d1);
  const h2 = isHorizontal(d2);

  if (h1 !== h2) {
    // Different axes: L-shape, single bend at the ray intersection
    const bend: Point = h1 ? { x: e2.x, y: e1.y } : { x: e1.x, y: e2.y };
    const all = cleanupCollinear([t1, e1, bend, e2, t2]);
    // Return only the intermediate points (not terminals)
    return all.slice(1, all.length - 1);
  }

  if (h1) {
    // Both horizontal
    const sameRow = Math.abs(e1.y - e2.y) < 2;
    if (sameRow) {
      const facingEachOther =
        (d1 === 'R' && d2 === 'L' && e1.x <= e2.x + 4) ||
        (d1 === 'L' && d2 === 'R' && e2.x <= e1.x + 4);
      if (facingEachOther) {
        // Straight through: terminals and jetties align
        const all = cleanupCollinear([t1, e1, e2, t2]);
        return all.slice(1, all.length - 1);
      }
      // Same row, facing away — detour above
      const detourY = Math.min(e1.y, e2.y) - 40;
      return [
        { x: e1.x, y: detourY },
        { x: e2.x, y: detourY },
      ];
    }
    // Different rows: vertical connector at horizontal midpoint
    const mx = (e1.x + e2.x) / 2;
    return [
      { x: mx, y: e1.y },
      { x: mx, y: e2.y },
    ];
  }

  // Both vertical
  const sameCol = Math.abs(e1.x - e2.x) < 2;
  if (sameCol) {
    const facingEachOther =
      (d1 === 'D' && d2 === 'U' && e1.y <= e2.y + 4) ||
      (d1 === 'U' && d2 === 'D' && e2.y <= e1.y + 4);
    if (facingEachOther) {
      const all = cleanupCollinear([t1, e1, e2, t2]);
      return all.slice(1, all.length - 1);
    }
    const detourX = Math.min(e1.x, e2.x) - 40;
    return [
      { x: detourX, y: e1.y },
      { x: detourX, y: e2.y },
    ];
  }
  const my = (e1.y + e2.y) / 2;
  return [
    { x: e1.x, y: my },
    { x: e2.x, y: my },
  ];
}

/**
 * Build an SVG path string from a full point list (including terminals),
 * with arc-rounded corners at every interior bend.
 */
export function buildRoundedPath(points: Point[], radius: number = 6): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const inDx = curr.x - prev.x;
    const inDy = curr.y - prev.y;
    const inLen = Math.sqrt(inDx * inDx + inDy * inDy);

    const outDx = next.x - curr.x;
    const outDy = next.y - curr.y;
    const outLen = Math.sqrt(outDx * outDx + outDy * outDy);

    if (inLen < 0.01 || outLen < 0.01) continue;

    const r = Math.min(radius, inLen * 0.45, outLen * 0.45);

    const stopX = curr.x - (inDx / inLen) * r;
    const stopY = curr.y - (inDy / inLen) * r;
    const startX = curr.x + (outDx / outLen) * r;
    const startY = curr.y + (outDy / outLen) * r;

    // Cross product determines turn direction; arc should curve around the outside
    const cross = inDx * outDy - inDy * outDx;
    const sweep = cross > 0 ? 1 : 0;

    d += ` L ${stopX} ${stopY}`;
    d += ` A ${r} ${r} 0 0 ${sweep} ${startX} ${startY}`;
  }

  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

/**
 * Build the full point list (terminals + waypoints in order) for path rendering.
 */
export function buildPointList(
  t1: Point,
  d1: Facing,
  t2: Point,
  d2: Facing,
  waypoints: Point[],
  jetty: number = 20,
): Point[] {
  if (waypoints.length > 0) {
    return [t1, ...waypoints, t2];
  }
  // Auto-route
  const e1 = extend(t1, d1, jetty);
  const e2 = extend(t2, d2, jetty);
  const autoWaypoints = routeOrthogonal(t1, d1, t2, d2, jetty);
  if (autoWaypoints.length === 0) {
    return cleanupCollinear([t1, e1, e2, t2]);
  }
  return [t1, ...autoWaypoints, t2];
}

/**
 * Compute the total path length for a set of points.
 */
export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}
