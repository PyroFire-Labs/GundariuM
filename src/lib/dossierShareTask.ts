/**
 * "Share Your Dossier" daily task has no on-chain proof of completion —
 * same self-reported pattern as the Daily Check-In page's other
 * localStorage-tracked tasks. Shared between the /tasks page (which reads
 * and displays it) and the dossier page itself (which can also mark it,
 * since sharing from either surface is the same action).
 */

const DOSSIER_SHARED_KEY = "gundarium-dossier-shared-date";

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDossierSharedToday(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DOSSIER_SHARED_KEY) === todayUtcDateString();
}

export function markDossierSharedToday(): void {
  localStorage.setItem(DOSSIER_SHARED_KEY, todayUtcDateString());
}
