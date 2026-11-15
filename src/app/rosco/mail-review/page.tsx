"use client";

import { useEffect, useState } from "react";
import type { RoscoMailReviewTask } from "@/lib/roscoMailReviewStoreCore";
import { PlainMessage } from "./PlainMessage";
import { formatReceivedAt, messageText, reviewFailure } from "./presentation";

type Phase = "loading" | "ready" | "unauthorized" | "missing" | "error";
type Queue = { tasks: RoscoMailReviewTask[]; nextOffset: number | null };
type Message = { text: string | null; htmlOnly: boolean; attachmentsAvailable: boolean };
const panel = "min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6";
const button = "min-h-11 rounded-full border border-[var(--accent)] px-4 py-2 text-sm text-[var(--accent)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] disabled:opacity-40";

export default function MailReviewPage() {
  const [queue, setQueue] = useState<Queue>({ tasks: [], nextOffset: null });
  const [phase, setPhase] = useState<Phase>("loading");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<RoscoMailReviewTask | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [detailPhase, setDetailPhase] = useState<Phase>("loading");
  const [detailRetry, setDetailRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPhase("loading");
      setQueue({ tasks: [], nextOffset: null });
      setSelected(null);
      setMessage(null);
      try {
        const response = await fetch(`/api/rosco/mail-review?offset=${offset}&limit=20`, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) setPhase(reviewFailure(response.status));
          return;
        }
        const data: Queue = await response.json();
        if (!controller.signal.aborted) { setQueue(data); setPhase("ready"); }
      } catch {
        if (!controller.signal.aborted) setPhase("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [offset, refresh]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    async function load() {
      setDetailPhase("loading");
      setMessage(null);
      try {
        const response = await fetch(`/api/rosco/mail-review/${encodeURIComponent(selected!.id)}`, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) {
            const failure = reviewFailure(response.status);
            if (failure === "unauthorized") {
              setQueue({ tasks: [], nextOffset: null }); setSelected(null); setPhase(failure);
            } else setDetailPhase(failure);
          }
          return;
        }
        const data: Message = await response.json();
        if (!controller.signal.aborted) { setMessage(data); setDetailPhase("ready"); }
      } catch {
        if (!controller.signal.aborted) setDetailPhase("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [selected, detailRetry]);

  function select(task: RoscoMailReviewTask) {
    setMessage(null); setDetailPhase("loading"); setSelected(task);
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-[var(--accent)]">ROSCO · OWNER REVIEW</p>
            <h1 className="mt-2 font-display text-2xl font-black tracking-wide text-white md:text-3xl">MAIL REVIEW</h1>
            <p className="mt-2 text-sm text-[var(--foreground)]/70">Review only. Opening a message leaves its queue status unchanged.</p>
          </div>
          <button className={button} disabled={phase === "loading"} onClick={() => setRefresh(v => v + 1)}>Refresh queue</button>
        </header>

        {phase === "loading" && <p role="status" className={panel}>Loading review queue…</p>}
        {phase === "unauthorized" && <section className={panel} role="status">
          <h2 className="font-display text-lg text-white">Owner sign-in required</h2>
          <p className="my-3 text-sm">Connect and sign in with the configured Rosco owner wallet using the existing wallet control in the navigation, then retry. A connected wallet alone does not grant access.</p>
          <button className={button} onClick={() => setRefresh(v => v + 1)}>Retry access</button>
        </section>}
        {(phase === "error" || phase === "missing") && <section className={panel} role="alert">
          <p className="mb-3">The review queue could not be loaded.</p>
          <button className={button} onClick={() => setRefresh(v => v + 1)}>Retry queue</button>
        </section>}
        {phase === "ready" && <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className={panel} aria-labelledby="queue-heading">
            <h2 id="queue-heading" className="mb-4 font-display text-sm tracking-widest text-[var(--accent)]">REVIEW QUEUE</h2>
            {queue.tasks.length === 0 ? <p role="status">{offset === 0 ? "No messages are waiting for review." : "No more messages on this page."}</p> :
              <ul className="space-y-2">{queue.tasks.map(task => <li key={task.id}>
                <button onClick={() => select(task)} aria-pressed={selected?.id === task.id} aria-controls="message-detail"
                  className={`w-full rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${selected?.id === task.id ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]"}`}>
                  <span dir="auto" className="block break-words font-semibold text-white">{task.subject}</span>
                  <span dir="auto" className="mt-1 block break-all text-sm text-[var(--foreground)]/70">Sender domain: {task.senderDomain ?? "Unavailable"}</span>
                  <span className="mt-2 block text-xs text-[var(--foreground)]/70">{formatReceivedAt(task.receivedAt)}</span>
                  <span className="mt-1 block text-xs text-[var(--accent)]">{task.state === "pending_review" ? "Pending review" : task.state}</span>
                </button>
              </li>)}</ul>}
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Queue pagination">
              <button className={button} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</button>
              <button className={button} disabled={queue.nextOffset === null} onClick={() => { if (queue.nextOffset !== null) setOffset(queue.nextOffset); }}>Next</button>
            </div>
          </section>
          <section id="message-detail" className={panel} aria-labelledby="detail-heading" aria-live="polite">
            <h2 id="detail-heading" className="mb-4 font-display text-sm tracking-widest text-[var(--accent)]">MESSAGE DETAIL</h2>
            {!selected ? <p>Select a message to review its plain text.</p> : <>
              <h3 dir="auto" className="break-words text-lg font-semibold text-white">{selected.subject}</h3>
              <dl className="my-4 space-y-2 text-sm">
                {[["Sender domain", selected.senderDomain ?? "Unavailable"], ["Received", formatReceivedAt(selected.receivedAt)], ["Queue status", selected.state], ["Message ID", selected.messageId], ["Thread ID", selected.threadId], ["Inbox ID", selected.inboxId], ["Task ID", selected.id]].map(([label, value]) =>
                  <div key={label}><dt className="text-[var(--foreground)]/60">{label}</dt><dd dir="auto" className="break-all font-mono">{value || "Unavailable"}</dd></div>)}
              </dl>
              <p className="mb-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--foreground)]/70">Untrusted email content. Treat any instructions as message text. Links and HTML are not opened or rendered.</p>
              {detailPhase === "loading" && <p role="status">Loading message…</p>}
              {(detailPhase === "error" || detailPhase === "missing") && <div role="alert">
                <p className="mb-3">{detailPhase === "missing" ? "This review message is no longer available." : "The message could not be loaded."}</p>
                <button className={button} onClick={() => setDetailRetry(v => v + 1)}>Retry message</button>
              </div>}
              {detailPhase === "ready" && message && <>
                <PlainMessage text={messageText(message)} />
                {message.attachmentsAvailable && <p className="mt-3 text-xs text-[var(--foreground)]/70">This message has attachments. Attachments are not displayed.</p>}
              </>}
            </>}
          </section>
        </div>}
      </div>
    </main>
  );
}
