"use client";

import { useEffect } from "react";
import { useConnect, useConnectors } from "wagmi";

export function FarcasterInit() {
  const { connect } = useConnect();
  const connectors = useConnectors();

  useEffect(() => {
    import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      await sdk.actions.ready();

      const context = await sdk.context;
      // Only auto-connect if we're inside a Farcaster client
      if (!context?.user?.fid) return;

      const farcasterConn = connectors.find((c) => c.id === "farcaster");
      if (farcasterConn) {
        connect({ connector: farcasterConn });
      }
    });
  // connectors is stable after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
