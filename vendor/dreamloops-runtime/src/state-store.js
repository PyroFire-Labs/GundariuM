import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function safeName(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function encodedBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

// Thrown by `put(key, value, { expectedVersion })` when the stored version
// no longer matches what the caller last read — i.e. someone else wrote to
// this key in between. This is the primitive that makes concurrent-runner
// detection possible: whoever loses the race gets this thrown back at them
// instead of silently clobbering (or being clobbered by) the winner.
export class StateVersionConflictError extends Error {
  constructor(key, expectedVersion, actualVersion) {
    super(`version conflict for key "${key}": expected version ${expectedVersion}, found ${actualVersion}`);
    this.name = "StateVersionConflictError";
    this.key = key;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class MemoryStateStore {
  constructor() {
    // key -> { value, version } — version starts at 1 on first write, a
    // never-written key reads as version 0.
    this.values = new Map();
    this.receipts = [];
  }

  async get(key) {
    return clone(this.values.get(key)?.value);
  }

  async getVersion(key) {
    return this.values.get(key)?.version ?? 0;
  }

  // No `await` between the version read and the write below, so this whole
  // check-then-set is atomic with respect to any other async work on the
  // same event loop — that's what makes the concurrent-runner adversarial
  // test deterministic rather than a timing gamble.
  async put(key, value, { expectedVersion } = {}) {
    const currentVersion = this.values.get(key)?.version ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new StateVersionConflictError(key, expectedVersion, currentVersion);
    }
    const nextVersion = currentVersion + 1;
    this.values.set(key, { value: clone(value), version: nextVersion });
    return nextVersion;
  }

  async delete(key) {
    return this.values.delete(key);
  }

  async list() {
    return [...this.values.keys()].sort();
  }

  async appendReceipt(receipt) {
    this.receipts.push(clone(receipt));
  }
}

export class FileStateStore {
  constructor({ directory, maxBytes = 1_048_576 } = {}) {
    if (!directory) throw new Error("FileStateStore requires a directory");
    this.directory = path.resolve(directory);
    this.maxBytes = maxBytes;
  }

  async initialize() {
    await fs.mkdir(path.join(this.directory, "state"), { recursive: true });
    await fs.mkdir(path.join(this.directory, "receipts"), { recursive: true });
  }

  statePath(key) {
    return path.join(this.directory, "state", `${safeName(key)}.json`);
  }

  async #readEnvelope(key) {
    try {
      const envelope = JSON.parse(await fs.readFile(this.statePath(key), "utf8"));
      if (envelope.key !== key) throw new Error("state key integrity check failed");
      return envelope;
    } catch (error) {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  async get(key) {
    await this.initialize();
    const envelope = await this.#readEnvelope(key);
    return envelope ? clone(envelope.value) : undefined;
  }

  async getVersion(key) {
    await this.initialize();
    const envelope = await this.#readEnvelope(key);
    return envelope?.version ?? 0;
  }

  // NOTE: this CAS is only safe against concurrency within a single Node
  // process (e.g. two DreamLoopRunner instances sharing one FileStateStore
  // in-process, as in the adversarial tests). Across separate OS processes
  // there is a real read-then-write race between the version read here and
  // the rename below — that would need real file locking (e.g. an flock-
  // guarded lease) to close, which is out of scope for the mock/local phase
  // this ledger is being built for. Naming this gap explicitly rather than
  // implying a guarantee this store doesn't actually provide.
  async put(key, value, { expectedVersion } = {}) {
    await this.initialize();
    const currentVersion = (await this.#readEnvelope(key))?.version ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new StateVersionConflictError(key, expectedVersion, currentVersion);
    }
    const nextVersion = currentVersion + 1;
    const envelope = { key, updatedAt: new Date().toISOString(), value: clone(value), version: nextVersion };
    if (encodedBytes(envelope) > this.maxBytes) throw new Error(`state exceeds ${this.maxBytes} byte ceiling`);
    const target = this.statePath(key);
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(envelope, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, target);
    return nextVersion;
  }

  async delete(key) {
    await this.initialize();
    try {
      await fs.unlink(this.statePath(key));
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  async list() {
    await this.initialize();
    const names = (await fs.readdir(path.join(this.directory, "state"))).filter((name) => name.endsWith(".json"));
    const keys = [];
    for (const name of names) {
      const envelope = JSON.parse(await fs.readFile(path.join(this.directory, "state", name), "utf8"));
      keys.push(envelope.key);
    }
    return keys.sort();
  }

  async appendReceipt(receipt) {
    await this.initialize();
    const redacted = { ...clone(receipt) };
    delete redacted.state;
    const date = new Date().toISOString().slice(0, 10);
    await fs.appendFile(path.join(this.directory, "receipts", `${date}.jsonl`), `${JSON.stringify(redacted)}\n`, { encoding: "utf8", mode: 0o600 });
  }
}
