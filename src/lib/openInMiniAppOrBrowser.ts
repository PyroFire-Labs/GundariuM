"use client";

/**
 * Opens a URL as a nested Farcaster miniapp when running inside one, so
 * the user stays in-app instead of getting booted to an external
 * browser tab. Falls back to a normal new-tab open outside Farcaster.
 */
export async function openInMiniAppOrBrowser(url: string) {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const ctx = await sdk.context;
    if (ctx?.user?.fid) {
      await sdk.actions.openMiniApp({ url });
      return;
    }
  } catch {
    /* sdk unavailable outside a Farcaster miniapp — fall through below */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
