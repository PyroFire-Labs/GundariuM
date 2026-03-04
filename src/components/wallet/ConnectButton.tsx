"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import * as Dialog from "@radix-ui/react-dialog";

const CONNECTOR_LABELS: Record<string, string> = {
  injected: "Browser Wallet",
  walletConnect: "WalletConnect",
  coinbaseWalletSDK: "Coinbase Wallet",
};

const CONNECTOR_ICONS: Record<string, string> = {
  injected: "🦊",
  walletConnect: "🔗",
  coinbaseWalletSDK: "🔵",
};

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDisconnect((v) => !v)}
          className="rounded-full border border-[var(--accent)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-black"
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </button>
        {showDisconnect && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDisconnect(false)}
            />
            <div className="absolute right-0 top-12 z-50 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl min-w-[160px]">
              <button
                onClick={() => {
                  disconnect();
                  setShowDisconnect(false);
                }}
                className="w-full rounded-lg px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="rounded-full border border-[var(--accent)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-black">
          Connect Wallet
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
          <Dialog.Title className="font-[family-name:var(--font-orbitron)] text-lg font-black text-[var(--accent)] mb-1">
            Connect Wallet
          </Dialog.Title>
          <Dialog.Description className="text-xs text-[var(--foreground)]/50 mb-5">
            Choose how you want to connect. WalletConnect works on any browser.
          </Dialog.Description>

          <div className="flex flex-col gap-2">
            {connectors.map((connector) => {
              const label =
                CONNECTOR_LABELS[connector.id] ?? connector.name;
              const icon = CONNECTOR_ICONS[connector.id] ?? "💼";
              return (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector });
                    setOpen(false);
                  }}
                  disabled={isPending}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-50"
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <Dialog.Close asChild>
            <button className="mt-4 w-full rounded-lg py-2 text-xs text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 transition-colors">
              Cancel
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
