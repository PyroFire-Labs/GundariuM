"use client";

import { useEffect } from "react";
import { useConfig, useConnect, useConnectors } from "wagmi";
import { reconnect } from "wagmi/actions";

export function FarcasterInit() {
  const { connect } = useConnect();
  const connectors = useConnectors();
  const config = useConfig();

  useEffect(() => {
    import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      await sdk.actions.ready();

      const context = await sdk.context;
      // Not inside a Farcaster client — restore whatever connector (Base
      // Account, injected, WalletConnect) the browser previously used.
      // Providers disables wagmi's automatic reconnectOnMount so this only
      // ever runs here, once we know we're not in a Farcaster context.
      if (!context?.user?.fid) {
        reconnect(config);
        return;
      }

      const farcasterConn = connectors.find((c) => c.id === "farcaster");
      if (farcasterConn) {
        connect({ connector: farcasterConn });
      }
    });
  // connectors/config are stable after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
