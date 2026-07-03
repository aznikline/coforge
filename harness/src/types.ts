// Core contracts for the wall-detection harness. A workspace plugs in via
// WorkspaceAdapter; a probe is a scaling or fault-injection test against it.

export interface MentionResult {
  readonly reply: string;
  readonly latencyMs: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
}

// A fault injector lets a cliff probe trigger the adversarial event the
// workspace's best-effort boundary is supposed to prevent — e.g. one agent
// attempting to read another's private state. The adapter implements this
// against its workspace's actual storage; the probe reads `crossed` to see
// whether the boundary held.
export interface FaultInjector {
  readonly id: string;
  // Inject a cross-agent read attempt. Returns whether the attacking agent
  // successfully read the target agent's private state (true = boundary FAILED).
  injectCrossRead(attacker: string, target: string): Promise<{ crossed: boolean; detail: string }>;
}

// A storage observer lets a scaling probe read the storage-side cost of
// unmanaged state (rows stored, with no eviction) — distinct from the
// prompt-side cost the history probe measures.
export interface StorageObserver {
  readonly id: string;
  // Count stored memory rows for an agent. Grows unboundedly if the
  // workspace has no eviction/lifecycle abstraction.
  countAgentMemory(agent: string): Promise<number>;
}

export interface WorkspaceAdapter {
  readonly name: string;
  sendMention(agent: string, text: string): Promise<MentionResult>;
  resetWorkspace(): Promise<void>;
  // Optional: fault injection for correctness-cliff probes. Adapters that
  // cannot inject (e.g. a workspace with no accessible storage) leave this
  // undefined, and cliff probes against them are skipped.
  readonly faultInjection?: FaultInjector;
  // Optional: storage observation for managed-state scaling probes.
  readonly storageObserver?: StorageObserver;
}

export interface Probe {
  readonly id: string;
  readonly description: string;
  run(adapter: WorkspaceAdapter): Promise<ProbeResult>;
}

export interface ProbePoint {
  readonly x: number;
  readonly y: number;
}

// Probe results split by wall family: scaling-pathology walls produce a
// growth curve; correctness-cliff walls produce a fault-cross rate.
export type ProbeResult =
  | ScalingProbeResult
  | CliffProbeResult;

export interface ScalingProbeResult {
  readonly kind: "scaling";
  readonly probeId: string;
  readonly wall: "serial-queue" | "prompt-replay" | "unbounded-state";
  readonly points: readonly ProbePoint[];
  readonly linearGrowth: boolean;
  readonly note: string;
}

export interface CliffProbeResult {
  readonly kind: "cliff";
  readonly probeId: string;
  readonly wall: "isolation-cliff" | "routing-cliff" | "composition-cliff";
  readonly trials: number;
  readonly crossedRate: number; // fraction of trials where the boundary FAILED
  readonly note: string;
}

export interface HarnessReport {
  readonly adapter: string;
  readonly results: readonly ProbeResult[];
}
