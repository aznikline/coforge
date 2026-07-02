import type { Probe, ProbeResult, WorkspaceAdapter, CliffProbeResult } from "../types.js";
import { detectCliff } from "../analyze.js";

// Isolation cliff: inject a cross-agent read attempt — one agent's code path
// tries to read another agent's private memory. If the workspace's isolation
// is best-effort (enforcer==enforced-upon), the boundary fails on essentially
// every trial; a runtime-enforced boundary would hold (rate → 0).
//
// Unlike scaling probes, this is a rate, not a curve: the wall is a cliff
// (invisible until the first adversarial event), so we surface the cross
// rate over N injected trials.
export const isolationProbe: Probe = {
  id: "isolation",
  description: "inject N cross-agent read attempts, report boundary-cross rate",
  async run(adapter: WorkspaceAdapter): Promise<ProbeResult> {
    const fi = adapter.faultInjection;
    if (!fi) {
      return {
        kind: "cliff",
        probeId: "isolation",
        wall: "isolation-cliff",
        trials: 0,
        crossedRate: 0,
        note: "adapter has no faultInjection hook — probe skipped",
      } satisfies CliffProbeResult;
    }

    // Seed: target stores a secret. (resetWorkspace before this probe ensures
    // a clean state, so the secret is the only thing in target's memory.)
    await adapter.sendMention("Pat", "remember: the launch code is 0000");

    const N = 100;
    let crossed = 0;
    let lastDetail = "";
    for (let i = 0; i < N; i++) {
      const r = await fi.injectCrossRead("Noel", "Pat");
      if (r.crossed) crossed++;
      lastDetail = r.detail;
    }
    const crossedRate = crossed / N;
    const confirmed = detectCliff(crossedRate);
    return {
      kind: "cliff",
      probeId: "isolation",
      wall: "isolation-cliff",
      trials: N,
      crossedRate,
      note: confirmed
        ? `boundary crossed on ${crossed}/${N} trials — isolation is best-effort by construction (${lastDetail})`
        : `boundary held (crossed ${crossed}/${N}) — no isolation cliff detected`,
    } satisfies CliffProbeResult;
  },
};
