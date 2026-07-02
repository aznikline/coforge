import type { ProbePoint, ProbeResult } from "./types.js";

// Two detectors, because the two walls grow differently:
//  - serial-queue latency scales WITH load (8 concurrent ≈ 8× one), so we
//    require the y-ratio to track the x-ratio.
//  - prompt-replay tokens grow monotonically but off a large base (system
//    prompt + prior turns), so 8 turns need not 8× the first turn's tokens;
//    we require monotonic increase and meaningful growth.

export function detectScaling(points: readonly ProbePoint[]): boolean {
  if (points.length < 2) return false;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const maxX = Math.max(...xs);
  const minX = Math.min(...xs);
  if (maxX === minX) return false;
  const monotonic = ys.every((y, i) => i === 0 || y >= ys[i - 1] * 0.85);
  const xRatio = maxX / minX;
  const yRatio = ys[ys.length - 1] / Math.max(1, ys[0]);
  return monotonic && yRatio >= xRatio * 0.5;
}

export function detectMonotonicGrowth(points: readonly ProbePoint[]): boolean {
  if (points.length < 2) return false;
  const ys = points.map((p) => p.y);
  const monotonic = ys.every((y, i) => i === 0 || y >= ys[i - 1] * 0.9);
  const grows = ys[ys.length - 1] >= ys[0] * 1.5;
  return monotonic && grows;
}

export function formatReport(r: ProbeResult): string {
  const pts = r.points.map((p) => `x=${p.x} y=${p.y}`).join("  ");
  return [
    `PROBE: ${r.probeId} (wall: ${r.wall})`,
    `  points: ${pts}`,
    `  linear-growth: ${r.linearGrowth ? "YES (wall confirmed)" : "no"}`,
    `  note: ${r.note}`,
  ].join("\n");
}
