import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import type { EvidenceEvent } from "./types.js";

// === Key Management ===

interface KeyPair {
  publicKey: string;   // PEM
  privateKey: string;  // PEM
}

const keyCache = new Map<string, KeyPair>();

/** Generate or retrieve an Ed25519 keypair for an agent. Keys are cached in-memory. */
export function getAgentKeyPair(agent: string): KeyPair {
  const existing = keyCache.get(agent);
  if (existing) return existing;

  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const pair: KeyPair = { publicKey, privateKey };
  keyCache.set(agent, pair);
  return pair;
}

// === Hashing ===

export function hashPayload(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

// === Signing ===

export function signPayload(privateKeyPem: string, payloadHash: string): string {
  const sig = sign(undefined, Buffer.from(payloadHash, "hex"), {
    key: privateKeyPem,
    format: "pem",
    type: "pkcs8",
    dsaEncoding: "ieee-p1363",
  });
  return sig.toString("hex");
}

export function verifySignature(
  publicKeyPem: string,
  payloadHash: string,
  signatureHex: string,
): boolean {
  return verify(
    undefined,
    Buffer.from(payloadHash, "hex"),
    { key: publicKeyPem, format: "pem", type: "spki", dsaEncoding: "ieee-p1363" },
    Buffer.from(signatureHex, "hex"),
  );
}

// === Evidence CRUD ===

const insertEvidenceStmt = (db: DatabaseSync) => db.prepare(
  `INSERT INTO evidence_events (id, run_id, task_id, stage_id, transition_id, event_type, actor, payload, payload_hash, prev_hash, signature, ts)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const listByRunStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM evidence_events WHERE run_id = ? ORDER BY ts ASC`
);

const getEvidenceStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM evidence_events WHERE id = ?`
);

const lastInChainStmt = (db: DatabaseSync) => db.prepare(
  `SELECT payload_hash FROM evidence_events WHERE run_id = ? ORDER BY ts DESC LIMIT 1`
);

export function recordEvidence(
  db: DatabaseSync,
  params: {
    run_id?: string;
    task_id?: string;
    stage_id?: string;
    transition_id?: string;
    event_type: EvidenceEvent["event_type"];
    actor: string;
    payload: Record<string, unknown>;
  },
): EvidenceEvent {
  const payloadStr = JSON.stringify(params.payload);
  const payloadHash = hashPayload(payloadStr);

  // Link to previous event in the same run's chain
  const prev = params.run_id
    ? (lastInChainStmt(db).get(params.run_id) as { payload_hash: string } | undefined)
    : undefined;
  const prevHash = prev?.payload_hash || "";

  const id = randomUUID();
  const ts = Date.now();

  insertEvidenceStmt(db).run(
    id,
    params.run_id || null,
    params.task_id || null,
    params.stage_id || null,
    params.transition_id || null,
    params.event_type,
    params.actor,
    payloadStr,
    payloadHash,
    prevHash,
    null,
    ts,
  );

  return {
    id,
    run_id: params.run_id,
    task_id: params.task_id,
    stage_id: params.stage_id,
    transition_id: params.transition_id,
    event_type: params.event_type,
    actor: params.actor,
    payload: payloadStr,
    payload_hash: payloadHash,
    prev_hash: prevHash,
    ts,
  };
}

export function signEvidence(
  db: DatabaseSync,
  evidenceId: string,
  actor: string,
): EvidenceEvent | null {
  const row = getEvidenceStmt(db).get(evidenceId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const keyPair = getAgentKeyPair(actor);
  const signature = signPayload(keyPair.privateKey, row.payload_hash as string);

  db.prepare("UPDATE evidence_events SET signature = ? WHERE id = ?").run(signature, evidenceId);

  return rowToEvidence({ ...row, signature });
}

export function getEvidence(db: DatabaseSync, id: string): EvidenceEvent | null {
  const row = getEvidenceStmt(db).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToEvidence(row);
}

export function listEvidence(db: DatabaseSync, run_id: string): EvidenceEvent[] {
  return (listByRunStmt(db).all(run_id) as Record<string, unknown>[]).map(rowToEvidence);
}

function rowToEvidence(row: Record<string, unknown>): EvidenceEvent {
  return {
    id: row.id as string,
    run_id: (row.run_id as string) || undefined,
    task_id: (row.task_id as string) || undefined,
    stage_id: (row.stage_id as string) || undefined,
    transition_id: (row.transition_id as string) || undefined,
    event_type: row.event_type as EvidenceEvent["event_type"],
    actor: row.actor as string,
    payload: row.payload as string,
    payload_hash: row.payload_hash as string,
    prev_hash: row.prev_hash as string,
    signature: (row.signature as string) || undefined,
    ts: row.ts as number,
  };
}

// === Chain Verification ===

export interface ChainIntegrityResult {
  valid: boolean;
  total: number;
  signed: number;
  verified: number;
  breaks: { event_id: string; reason: string }[];
}

/** Verify the entire evidence chain for a run. Checks hash linking + signature validity. */
export function verifyChain(db: DatabaseSync, run_id: string): ChainIntegrityResult {
  const events = listEvidence(db, run_id);
  const result: ChainIntegrityResult = { valid: true, total: events.length, signed: 0, verified: 0, breaks: [] };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    // Verify chain link (except first event)
    if (i > 0) {
      const prev = events[i - 1];
      if (ev.prev_hash !== prev.payload_hash) {
        result.valid = false;
        result.breaks.push({
          event_id: ev.id,
          reason: `chain broken: expected prev_hash=${prev.payload_hash.slice(0,16)}..., got ${ev.prev_hash.slice(0,16)}...`,
        });
      }
    }

    // Verify signature if present
    if (ev.signature) {
      result.signed++;
      const keyPair = getAgentKeyPair(ev.actor);
      const valid = verifySignature(keyPair.publicKey, ev.payload_hash, ev.signature);
      if (valid) {
        result.verified++;
      } else {
        result.valid = false;
        result.breaks.push({
          event_id: ev.id,
          reason: `signature verification failed for actor ${ev.actor}`,
        });
      }
    }

    // Verify payload hash matches stored hash
    const computedHash = hashPayload(ev.payload);
    if (computedHash !== ev.payload_hash) {
      result.valid = false;
      result.breaks.push({
        event_id: ev.id,
        reason: `payload hash mismatch: computed ${computedHash.slice(0,16)}..., stored ${ev.payload_hash.slice(0,16)}...`,
      });
    }
  }

  return result;
}

/** Record a 4W evidence event (Who/What/When/Why) at a stage transition. */
export function recordTransitionEvidence(
  db: DatabaseSync,
  params: {
    run_id: string;
    stage_id: string;
    transition_id: string;
    from_stage_name: string;
    to_stage_name: string;
    reviewer: string;
    artifacts?: string[];
    gate_result: { passed: boolean; reason: string };
  },
): EvidenceEvent {
  const evidence = recordEvidence(db, {
    run_id: params.run_id,
    stage_id: params.stage_id,
    transition_id: params.transition_id,
    event_type: "transition_executed",
    actor: params.reviewer,
    payload: {
      Who: params.reviewer,
      What: params.artifacts?.map(a => hashPayload(a)) || [],
      When: new Date().toISOString(),
      Why: params.gate_result.reason,
      transition: `${params.from_stage_name} → ${params.to_stage_name}`,
    },
  });

  // Auto-sign if the actor has a keypair
  const keyPair = getAgentKeyPair(params.reviewer);
  const signature = signPayload(keyPair.privateKey, evidence.payload_hash);
  db.prepare("UPDATE evidence_events SET signature = ? WHERE id = ?").run(signature, evidence.id);

  return { ...evidence, signature };
}
