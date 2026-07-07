import type { ProbePoint, ProbeResult, ScalingProbeResult, CliffProbeResult } from "./types.js";

// Two detectors, because the two scaling walls grow differently:
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
  // If the first value is 0 (e.g. the workspace didn't surface token usage),
  // the 1.5× test is vacuously true — require a nonzero baseline.
  if (ys[0] <= 0) return false;
  const monotonic = ys.every((y, i) => i === 0 || y >= ys[i - 1] * 0.9);
  const grows = ys[ys.length - 1] >= ys[0] * 1.5;
  return monotonic && grows;
}

// A cliff is "confirmed" (the boundary is best-effort) when the cross rate
// is high — i.e. the attacking agent usually succeeds. Rate >= 0.9 means
// the workspace's isolation fails on essentially every trial.
export function detectCliff(crossedRate: number): boolean {
  return crossedRate >= 0.9;
}

export function formatReport(r: ProbeResult): string {
  if (r.kind === "scaling") return formatScaling(r);
  return formatCliff(r);
}

function formatScaling(r: ScalingProbeResult): string {
  const pts = r.points.map((p) => `x=${p.x} y=${p.y}`).join("  ");
  return [
    `PROBE: ${r.probeId} (wall: ${r.wall})`,
    `  points: ${pts}`,
    `  linear-growth: ${r.linearGrowth ? "YES (wall confirmed)" : "no"}`,
    `  note: ${r.note}`,
  ].join("\n");
}

function formatCliff(r: CliffProbeResult): string {
  const ratePct = (r.crossedRate * 100).toFixed(0);
  return [
    `PROBE: ${r.probeId} (wall: ${r.wall})`,
    `  trials: ${r.trials}  crossed: ${ratePct}%`,
    `  cliff: ${r.crossedRate >= 0.9 ? "YES (boundary best-effort — wall confirmed)" : "no"}`,
    `  note: ${r.note}`,
  ].join("\n");
}
