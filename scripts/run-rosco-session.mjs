import crypto from "node:crypto";
import fs from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  DreamLoopRunner,
  FileStateStore,
} from "@dreamloops/runtime";

const execFile = promisify(execFileCallback);
const root = process.cwd();

const readJson = (file) =>
  fs.readFile(file, "utf8").then(JSON.parse);

const hash = (value) =>
  `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;

async function summarizeFile(file) {
  const content = await fs.readFile(file, "utf8");

  return {
    file,
    bytes: Buffer.byteLength(content),
    contentHash: hash(content),
  };
}

const taskFlag = process.argv.indexOf("--task");
const selectedTask =
  taskFlag >= 0 ? process.argv[taskFlag + 1] : null;

const sessionId = new Date().toISOString().replace(/[:.]/g, "-");

const capsule = await readJson(".rosco/rosco-session.capsule.json");
const loop = await readJson(".rosco/rosco-session-start.dreamloop.json");

const store = new FileStateStore({
  directory: ".rosco/runtime-state",
});

const runner = new DreamLoopRunner({
  stateStore: store,

  grantedPermissions: [
    "context.local.read",
    "task.local.read",
    "repository.status.read",
    "repository.head.read",
    "receipt.local.write",
  ],

  handlers: {
    "context.local.read": async () => ({
      contextFiles: await Promise.all([
        summarizeFile(".rosco/README.md"),
        summarizeFile(".rosco/LOOP.md"),
        summarizeFile(".rosco/STATE.md"),
        summarizeFile(".rosco/DECISIONS.md"),
        summarizeFile(".rosco/VERIFY.md"),
      ]),
    }),

    "task.local.read": async () => ({
      selectedTask,
      authorizationStatus: selectedTask
        ? "OPERATOR_SUPPLIED_TASK — implementation still requires authority review"
        : "NEEDS_APPROVAL — no task was supplied",
      taskBoard: await summarizeFile(".rosco/TASKS.md"),
    }),

    "repository.status.read": async () => {
      const { stdout } = await execFile(
        "git",
        ["status", "--short"],
        { cwd: root }
      );

      const lines = stdout.trim()
        ? stdout.trim().split("\n")
        : [];

      return {
        changedEntries: lines.length,
        gitStatusHash: hash(stdout),
      };
    },

    "repository.head.read": async () => {
      const { stdout } = await execFile(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: root }
      );

      return { gitHead: stdout.trim() };
    },

    "receipt.local.write": async ({ state }) => {
      const timestamp = new Date().toISOString();
      const receiptPath =
        `.rosco/receipts/${sessionId}-session-start.json`;

      const roscoReceipt = {
        version: "rosco-receipt/1",
        id: `rosco-session-start-${sessionId}`,
        timestamp,
        actor: "Rosco",

        task: {
          id: selectedTask ?? "rosco-session-start",
          title: selectedTask
            ? `Session start for ${selectedTask}`
            : "Rosco session start",
          scope: "Local context, task-board, and Git-state inspection only.",
        },

        approval: selectedTask
          ? "An operator supplied a task identifier; implementation authority has not been established by this loop."
          : "No task was supplied. This session performed read-only startup work only.",

        intent:
          "Load Rosco context, capture local repository state, and stop before implementation or external action.",

        execution: {
          status: "EXECUTED",
          evidence: [
            "Read Rosco operating-context file summaries.",
            "Read the Rosco task-board summary.",
            `Captured Git HEAD: ${state.gitHead}.`,
            `Captured ${state.changedEntries} Git status entries; snapshot hash: ${state.gitStatusHash}.`,
          ],
        },

        verification: {
          status: "UNVERIFIED",
          evidence: [
            "The session-start runner executed locally.",
            "No independent verifier or external system was consulted.",
          ],
        },

        effect: {
          status: "NONE",
          evidence: [
            "No deployment, contract call, wallet action, API mutation, or external communication was attempted.",
          ],
        },

        authority: {
          status: "NOT_REQUIRED",
          basis: "This loop performs local read-only inspection and writes local Rosco receipts only.",
        },

        outcome: "NEEDS_APPROVAL",

        facts: [
          {
            label: "CONFIRMED",
            claim: `The local session-start loop captured Git revision ${state.gitHead} and ${state.changedEntries} working-tree entries.`,
            source: "scripts/run-rosco-session.mjs",
          },
          {
            label: "CONFIRMED",
            claim: "No external effect was attempted by this session-start loop.",
            source: "Local runner configuration and receipt handler",
          },
          {
            label: "UNKNOWN",
            claim: "No implementation task is authorized merely because this session-start loop executed.",
            source: ".rosco/LOOP.md",
          },
        ],

        handoff: {
          next_action: selectedTask
            ? `Review authority and acceptance criteria for ${selectedTask} before any implementation.`
            : "Josh must explicitly authorize one atomic task before Rosco performs implementation work.",
          blockers: [
            "No implementation authority is established by this local session-start receipt.",
          ],
        },
      };

      await fs.writeFile(
        receiptPath,
        `${JSON.stringify(roscoReceipt, null, 2)}\n`,
        { mode: 0o600 }
      );

      return {
        roscoReceiptPath: receiptPath,
        externalEffect: "none",
      };
    },
  },
});

const receipt = await runner.run({
  capsule,
  loop,
  input: { selectedTask },
  stateKey: `rosco:session-start:${sessionId}`,
  executionMode: "local",
  authority: { status: "UNAUTHORIZED" },
});

console.log(JSON.stringify(receipt, null, 2));
