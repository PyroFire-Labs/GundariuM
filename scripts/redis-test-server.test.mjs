import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { withRedisTestServer } from "./lib/redis-test-server.mjs";

async function withRoot(body) {
  const root = await mkdtemp(join(tmpdir(), "redis-harness-"));
  try {
    await body(root);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Redis harness reports missing CLI without leaving scratch directories", { timeout: 3_000 }, async () => {
  await withRoot(async root => {
    await assert.rejects(withRedisTestServer(() => assert.fail("must not run"), {
      root, cliCommand: "rosco-synthetic-missing-redis-cli",
    }), /Redis CLI unavailable.*ENOENT/);
  });
});

test("Redis harness reports failed server spawn and cleanup does not wait for exit", { timeout: 3_000 }, async () => {
  await withRoot(async root => {
    await assert.rejects(withRedisTestServer(() => assert.fail("must not run"), {
      root, cliCommand: process.execPath, serverCommand: "rosco-synthetic-missing-redis-server",
    }), /Redis server startup failed.*ENOENT/);
  });
});

test("Redis harness reports early process exit and later tests still run", { timeout: 3_000 }, async () => {
  await withRoot(async root => {
    await assert.rejects(withRedisTestServer(() => assert.fail("must not run"), {
      root, cliCommand: process.execPath, serverCommand: process.execPath,
      serverArgs: ["-e", "process.exit(17)"],
    }), /Redis server exited before readiness/);
  });
});

test("Redis harness times out and kills a server that ignores graceful shutdown", { timeout: 3_000 }, async () => {
  await withRoot(async root => {
    await assert.rejects(withRedisTestServer(() => assert.fail("must not run"), {
      root, cliCommand: process.execPath, serverCommand: process.execPath,
      serverArgs: ["-e", 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'],
      startupMs: 250, stopMs: 100,
    }), /Redis server readiness timed out/);
  });
});

test("Redis harness handles an already-exited process without hanging cleanup", { timeout: 3_000 }, async () => {
  await withRoot(async root => {
    await withRedisTestServer(async () => { await delay(100); }, {
      root, cliCommand: process.execPath, serverCommand: process.execPath,
      serverArgs: ["-e", 'console.log("Ready to accept connections"); setTimeout(() => process.exit(0), 10)'],
    });
  });
});
