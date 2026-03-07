"use client";

import { useEffect } from "react";

export function FarcasterInit() {
  useEffect(() => {
    import("@farcaster/miniapp-sdk").then(({ sdk }) => {
      sdk.actions.ready();
    });
  }, []);

  return null;
}
