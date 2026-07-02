// Core contracts for the wall-detection harness. A workspace plugs in via
// WorkspaceAdapter; a probe is a scaling/fault-injection test against it.

export interface MentionResult {
  readonly reply: string;
  readonly latencyMs: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
}

export interface WorkspaceAdapter {
  readonly name: string;
  sendMention(agent: string, text: string): Promise<MentionResult>;
  resetWorkspace(): Promise<void>;
  // Future: faultInjection?: FaultInjector; — stubbed, not implemented this round.
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

export interface ProbeResult {
  readonly probeId: string;
  readonly wall: "serial-queue" | "prompt-replay";
  readonly points: readonly ProbePoint[];
  readonly linearGrowth: boolean;
  readonly note: string;
}

export interface HarnessReport {
  readonly adapter: string;
  readonly results: readonly ProbeResult[];
}
