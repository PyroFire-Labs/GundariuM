"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  usePublicClient,
} from "wagmi";
import { formatUnits, parseEther } from "viem";
import { base } from "viem/chains";

const GUNR_CAIP19 = "eip155:8453/erc20:0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07";
const ETH_CAIP19  = "eip155:8453/native";

const GUNR_ADDRESS = "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07";
const QUICK_AMOUNTS = ["0.001", "0.01", "0.1", "1"];

type Phase = "idle" | "quoting" | "swapping" | "done" | "error";

export default function BuyGunrPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: base.id });

  const [ethAmount, setEthAmount] = useState("0.01");
  const [gunrQuote, setGunrQuote] = useState<bigint | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<bigint | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFarcaster, setIsFarcaster] = useState(false);

  // Detect Farcaster miniapp context and immediately launch native swap
  useEffect(() => {
    import("@farcaster/miniapp-sdk").then(({ sdk }) => {
      sdk.context.then((ctx) => {
        if (!ctx?.user?.fid) return;
        setIsFarcaster(true);
        // Launch native Farcaster swap immediately — no amount pre-set, user picks in Warpcast
        sdk.actions.swapToken({ buyToken: GUNR_CAIP19 }).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMainnet = chainId === base.id;

  // Live ticker: 0.01 ETH → GUNR, refreshes every 30s
  const [tickerGunr, setTickerGunr] = useState<string | null>(null);
  useEffect(() => {
    const TICKER_SELL = parseEther("0.01").toString();
    const fetchTicker = async () => {
      try {
        const res = await fetch(`/api/gunr-quote?sellAmount=${TICKER_SELL}`);
        const json = await res.json();
        if (json.buyAmount) {
          const n = parseFloat(formatUnits(BigInt(json.buyAmount), 18));
          if (n >= 1_000_000) setTickerGunr(`${(n / 1_000_000).toFixed(2)}M`);
          else if (n >= 1_000) setTickerGunr(`${(n / 1_000).toFixed(1)}K`);
          else setTickerGunr(n.toLocaleString(undefined, { maximumFractionDigits: 0 }));
        }
      } catch { /* non-critical */ }
    };
    fetchTicker();
    const id = setInterval(fetchTicker, 30_000);
    return () => clearInterval(id);
  }, []);

  // Debounced indicative price from server route
  useEffect(() => {
    const amt = parseFloat(ethAmount);
    if (!isMainnet || !ethAmount || isNaN(amt) || amt <= 0) {
      setGunrQuote(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPhase("quoting");
    debounceRef.current = setTimeout(async () => {
      try {
        const sellAmount = parseEther(ethAmount).toString();
        const res = await fetch(`/api/gunr-quote?sellAmount=${sellAmount}`);
        const json = await res.json();
        if (json.buyAmount) {
          setGunrQuote(BigInt(json.buyAmount));
        } else {
          setGunrQuote(null);
        }
      } catch {
        setGunrQuote(null);
      } finally {
        setPhase("idle");
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ethAmount, isMainnet]);

  const handleBuy = useCallback(async () => {
    if (!ethAmount || parseFloat(ethAmount) <= 0) return;
    setPhase("swapping");
    setErrorMsg(null);
    try {
      // ── Farcaster miniapp: use native swap interface ──────────────────────
      if (isFarcaster) {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const sellAmount = parseEther(ethAmount).toString();
        const result = await sdk.actions.swapToken({
          sellToken: ETH_CAIP19,
          buyToken: GUNR_CAIP19,
          sellAmount,
        });
        if (!result.success) {
          if (result.reason === "rejected_by_user") {
            setPhase("idle");
            return;
          }
          throw new Error(result.error?.message ?? "Swap failed");
        }
        setTxHash(result.swap.transactions[0] ?? null);
        setReceivedAmount(gunrQuote);
        setPhase("done");
        return;
      }

      // ── Browser: 0x swap via wagmi ────────────────────────────────────────
      if (!address) return;
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }

      const sellAmount = parseEther(ethAmount).toString();
      const res = await fetch(
        `/api/gunr-swap?sellAmount=${sellAmount}&taker=${address}`
      );
      const quote = await res.json();

      if (!res.ok || quote.error) {
        throw new Error(quote.error || "Failed to get swap quote");
      }
      if (quote.liquidityAvailable === false) {
        throw new Error("No liquidity available for this swap");
      }

      const hash = await sendTransactionAsync({
        to: quote.to as `0x${string}`,
        data: quote.data as `0x${string}`,
        value: BigInt(quote.value ?? sellAmount),
        chainId: base.id,
      });

      await publicClient?.waitForTransactionReceipt({ hash });

      setTxHash(hash);
      setReceivedAmount(gunrQuote);
      setPhase("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Swap failed";
      setErrorMsg(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  }, [address, ethAmount, gunrQuote, isFarcaster, sendTransactionAsync, publicClient, switchChainAsync, chainId]);

  const formatGunr = (val: bigint) => {
    const n = parseFloat(formatUnits(val, 18));
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // ─── Done State ────────────────────────────────────────────────────────────
  if (phase === "done" && txHash) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center space-y-4">
          <div className="text-5xl">🔥</div>
          <h2 className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
            GUNR ACQUIRED
          </h2>
          {receivedAmount && (
            <p className="text-[var(--foreground)]/70">
              You received{" "}
              <span className="text-[var(--accent)] font-bold">
                {formatGunr(receivedAmount)} GUNR
              </span>
            </p>
          )}
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-[var(--foreground)]/40 hover:text-[var(--accent)] transition-colors break-all"
          >
            {txHash}
          </a>
          <button
            onClick={() => {
              setPhase("idle");
              setTxHash(null);
              setReceivedAmount(null);
              setGunrQuote(null);
            }}
            className="w-full rounded-lg border border-[var(--border)] py-2 text-sm font-bold text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors"
          >
            Buy More
          </button>
        </div>
      </main>
    );
  }

  // ─── Main UI ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-black tracking-wider text-[var(--accent)]">
            BUY GUNR 🔥
          </h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Power your battles on Base
          </p>
        </div>

        {/* Live price ticker */}
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-[var(--foreground)]/50">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            GUNR / ETH
          </span>
          <span className="text-[var(--accent)] font-bold tracking-wide">
            {tickerGunr ? `0.01 ETH = ${tickerGunr} GUNR` : "—"}
          </span>
          <span className="text-[var(--foreground)]/30">OKX DEX</span>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
          {/* Chain warning */}
          {isConnected && !isMainnet && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-center justify-between gap-3">
              <span className="text-yellow-400 text-sm font-medium">
                Switch to Base mainnet to buy
              </span>
              <button
                onClick={() => switchChainAsync({ chainId: base.id })}
                className="text-xs font-bold bg-yellow-500 text-black px-3 py-1 rounded-lg hover:brightness-110 transition-all"
              >
                Switch
              </button>
            </div>
          )}

          {/* ETH input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
              You Pay
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
              <input
                type="number"
                min="0"
                step="0.001"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold text-[var(--foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.01"
              />
              <span className="text-sm font-bold text-[var(--foreground)]/50">ETH</span>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setEthAmount(a)}
                  className={`flex-1 rounded-md py-1 text-xs font-bold transition-all ${
                    ethAmount === a
                      ? "bg-[var(--accent)] text-black"
                      : "border border-[var(--border)] text-[var(--foreground)]/50 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="text-center text-[var(--foreground)]/30 text-lg">↓</div>

          {/* GUNR output */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
              You Receive
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 min-h-[52px]">
              <span className="flex-1 text-lg font-bold text-[var(--accent)]">
                {phase === "quoting" ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-[var(--foreground)]/40">Fetching…</span>
                  </span>
                ) : gunrQuote !== null ? (
                  `~${formatGunr(gunrQuote)}`
                ) : (
                  <span className="text-[var(--foreground)]/30 text-sm">
                    {isMainnet ? "Enter an amount" : "Switch to Base mainnet"}
                  </span>
                )}
              </span>
              <span className="text-sm font-bold text-[var(--accent)]/70">GUNR</span>
            </div>
          </div>

          {/* Error */}
          {phase === "error" && errorMsg && (
            <p className="text-red-400 text-sm text-center">{errorMsg}</p>
          )}

          {/* Action button */}
          {!isConnected ? (
            <p className="text-center text-sm text-[var(--foreground)]/50 py-2">
              Connect your wallet to buy
            </p>
          ) : !isMainnet ? (
            <button
              onClick={() => switchChainAsync({ chainId: base.id })}
              className="w-full rounded-lg bg-yellow-500 text-black font-bold py-3 hover:brightness-110 transition-all"
            >
              Switch to Base Mainnet
            </button>
          ) : (
            <button
              onClick={handleBuy}
              disabled={
                phase === "swapping" ||
                phase === "quoting" ||
                !gunrQuote
              }
              className="w-full rounded-lg bg-[var(--accent)] text-black font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
            >
              {phase === "swapping" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  SWAPPING…
                </span>
              ) : (
                "BUY GUNR 🔥"
              )}
            </button>
          )}

          {/* Info footer */}
          <p className="text-center text-xs text-[var(--foreground)]/30">
            Routed via 0x · Best available price · 2% max slippage
          </p>
        </div>

        {/* Contract link */}
        <p className="text-center text-xs text-[var(--foreground)]/30">
          GUNR:{" "}
          <a
            href={`https://basescan.org/token/${GUNR_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--accent)] transition-colors"
          >
            {GUNR_ADDRESS.slice(0, 6)}…{GUNR_ADDRESS.slice(-4)}
          </a>
        </p>
      </div>
    </main>
  );
}
