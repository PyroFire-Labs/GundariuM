/**
 * Single source of truth for the app's target chain.
 *
 * Consumers previously derived this inline from NEXT_PUBLIC_CHAIN_ID with
 * DISAGREEING defaults: rerollVerification.ts fell through to Base mainnet
 * when the var was unset (Number(undefined) is NaN, which never equals
 * baseSepolia.id), while collection/page.tsx and MintConfirm.tsx both
 * defaulted to Base Sepolia via `?? 84532`. A server defaulting to mainnet
 * while the client defaults to Sepolia means the backend verifies a paid
 * reroll against a chain the burn never happened on.
 *
 * Plain data from viem/chains plus a NEXT_PUBLIC_ env read, so this is
 * safely importable from both server-side libs and "use client" hooks.
 */

import { base, baseSepolia } from "viem/chains";

export const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
export const TARGET_CHAIN = TARGET_CHAIN_ID === base.id ? base : baseSepolia;
