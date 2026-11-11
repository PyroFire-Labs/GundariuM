# `@dreamloops/runtime`

Dependency-free Capsule validation, canonical hashing, composition, durable local state, and bounded DreamLoop execution for Node.js 18.17 or newer.

## Guarantees

- Manifests remain inert data.
- Unknown handlers fail closed.
- Capsule, Loop, and host grants must agree on every permission.
- Blocked permissions override allowed permissions.
- Steps, retries, wall time, and durable state size are bounded.
- Failed executions produce failure receipts.
- Durable receipt logs exclude full working state.
- Capsule composition preserves parent hashes and chooses the lowest shared resource ceiling.

## Example

```js
import {
  DreamLoopRunner,
  FileStateStore,
  composeCapsules,
} from "@dreamloops/runtime";

const capsule = composeCapsules(baseCapsule, [dailyLifeCapsule]);
const store = new FileStateStore({ directory: ".dreamloops-state" });
const runner = new DreamLoopRunner({
  stateStore: store,
  grantedPermissions: ["runtime.health.read", "receipt.local.write"],
  handlers: {
    "runtime.health.read": async () => ({ healthy: true }),
    "receipt.local.write": async () => ({ evidenceWritten: true }),
  },
});

const receipt = await runner.run({
  capsule,
  loop: heartbeatLoop,
  stateKey: "agent:heartbeat",
  executionMode: "local",
});
```

The host application owns handler implementations, connector credentials, scheduling, and every live authority decision.
