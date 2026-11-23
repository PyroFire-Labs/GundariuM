import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

async function closedWithin(closed, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      closed.then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Isolated real Redis only: missing tools fail, never silently skip coverage. */
export async function withRedisTestServer(body, {
  root = tmpdir(), cliCommand = "redis-cli", serverCommand = "redis-server",
  serverArgs, startupMs = 5_000, stopMs = 1_000,
} = {}) {
  try {
    await execute(cliCommand, ["--version"], { timeout: startupMs, killSignal: "SIGKILL" });
  } catch (error) {
    throw new Error(`Redis CLI unavailable (${error.code ?? "startup error"}); provision redis-server and redis-tools in the approved development/test image.`);
  }
  const directory = await mkdtemp(join(root, "rosco-mail-"));
  const socket = join(directory, "redis.sock");
  let child;
  let closed;
  try {
    child = spawn(serverCommand, serverArgs ?? [
      "--port", "0", "--unixsocket", socket, "--save", "", "--appendonly", "no",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    // Observe close from the beginning, including error-before-spawn and early exit.
    closed = new Promise(resolve => child.once("close", resolve));
    child.on("error", () => {});
    child.stderr.resume();
    await new Promise((resolve, reject) => {
      let output = "";
      const finish = error => {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        child.off("error", onError);
        child.off("exit", onExit);
        if (error) reject(error); else resolve();
      };
      const onData = chunk => {
        output = (output + chunk.toString()).slice(-256).toLowerCase();
        if (output.includes("ready to accept connections")) finish();
      };
      const onError = error => finish(new Error(`Redis server startup failed (${error.code ?? "startup error"})`));
      const onExit = code => finish(new Error(`Redis server exited before readiness (code ${code})`));
      const timer = setTimeout(() => finish(new Error("Redis server readiness timed out")), startupMs);
      child.stdout.on("data", onData);
      child.once("error", onError);
      child.once("exit", onExit);
    });
    const command = async (...args) => JSON.parse((await execute(cliCommand, [
      "-s", socket, "--json", ...args.map(String),
    ], { timeout: 5_000, killSignal: "SIGKILL" })).stdout);
    return await body({
      eval: (script, keys, args) => command("EVAL", script, keys.length, ...keys, ...args),
      get: async key => {
        const value = await command("GET", key);
        return value === null ? null : JSON.parse(value);
      },
      lrange: (key, start, stop) => command("LRANGE", key, start, stop),
    });
  } finally {
    try {
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        if (!await closedWithin(closed, stopMs)) {
          child.kill("SIGKILL");
          if (!await closedWithin(closed, stopMs)) throw new Error("Redis server cleanup timed out");
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
