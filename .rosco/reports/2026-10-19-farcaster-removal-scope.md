# Farcaster removal scope

Date: 2026-10-19. Actor: Rosco. This is a read-only scope map. It does not remove code, alter contracts, or deploy.

> **Superseded scope correction, 2026-10-19:** Josh clarified that GundariuM should stop being accessible through Farcaster/Network School, while remaining a Base-native app and retaining Neynar. The broad “remove Farcaster/Neynar integration” reading below is not an implementation plan. Do not remove Neynar, Base-native features, or generic sharing based on this report. The active task is `farcaster-access-removal-scope` in `TASKS.md`.

## Original broad discovery map — not approved for implementation

| Classification | Paths | Reason |
|---|---|---|
| Remove | `src/components/providers/FarcasterInit.tsx`, `src/lib/farcasterConnector.ts`, Farcaster connector setup in `src/lib/wagmi.ts`, and the `FarcasterInit` render in `src/components/providers/Providers.tsx` | Automatic miniapp SDK loading and embedded-wallet connection. |
| Remove | `@farcaster/miniapp-sdk` from `package.json` and corresponding lockfile entries | SDK is used only by Farcaster integration code found in this scope. |
| Remove | `fc:miniapp` metadata in `src/app/layout.tsx` and `src/app/.well-known/farcaster.json/route.ts` | Miniapp embed and account-association manifest. |
| Replace | `src/lib/openInMiniAppOrBrowser.ts` and its Navbar/home/stake/tasks call sites | Preserve ordinary external links using a browser-only helper or direct safe links; remove SDK behavior. |
| Remove or redesign | `src/lib/neynar.ts`, `src/app/api/runner-profile/[address]/route.ts`, `src/lib/hooks/useRunnerProfile.ts`, Farcaster fields in `src/types/runner.ts`, and their dossier/leaderboard/card/OG consumers | Wallet profile data currently comes from Neynar/Farcaster. The safe initial replacement is wallet-address display plus the existing lineup store; custom profiles require a separate approved feature. |
| Remove or redesign | Farcaster share actions and verified-share EXP UI: `src/components/ui/ShareButtons.tsx`, `src/lib/contracts/hooks/useVerifiedShare.ts`, `src/lib/contracts/hooks/useDossierShareVerification.ts`, `src/lib/contracts/hooks/useArenaBattleShareVerification.ts`, `src/app/tasks/page.tsx`, and dossier/Arena call sites | These paths are explicitly Farcaster-oriented. Generic web sharing can remain; Farcaster-only EXP claims must be removed or redesigned. |
| Preserve | `contracts/src/DossierShareLog.sol`, `contracts/src/ArenaBattleLog.sol`, deployed address configuration, and existing on-chain history | Removing a web integration does not authorize a contract/economic/history change. |
| Preserve | Base Account, injected, WalletConnect, SIWE, minting, Arena, 3D/Meshy work, and ordinary browser navigation | These are independent from Farcaster based on `src/lib/wagmi.ts`, `src/components/wallet/ConnectButton.tsx`, and the inspected source. |

## Confirmed dependencies and limits

- **CONFIRMED:** `package.json` declares `@farcaster/miniapp-sdk`; `src/lib/neynar.ts` uses `NEYNAR_API_KEY` to look up Farcaster identities.
- **CONFIRMED:** `src/components/wallet/ConnectButton.tsx` skips SIWE for the Farcaster connector. Removing the connector must leave SIWE enabled for every remaining connector.
- **CONFIRMED:** `src/app/layout.tsx` includes `fc:miniapp` metadata; `src/app/.well-known/farcaster.json/route.ts` exposes account-association values from environment variables.
- **CONFIRMED:** Existing Dossier profile and verified-share behavior has Farcaster-specific types, UI, and API dependencies. A simple dependency uninstall without source changes would break compilation.
- **INFERRED:** A first safe removal release should preserve generic browser share links and wallet-address dossier identity, while removing Farcaster-specific profile enrichment and social-EXP affordances. Custom user profiles should be a later, separately approved capability.
- **UNKNOWN:** Whether public documentation, legal pages, whitepaper, archived social links, or user-visible historical copy should be revised in the same release. They do not need to change for the runtime integration removal, but Josh should choose the communication scope.

## Required implementation order

1. Remove SDK-dependent providers, connector, miniapp metadata, manifest, and navigation helper behavior.
2. Remove Farcaster/Neynar profile resolution while retaining address-plus-lineup dossier rendering.
3. Remove or neutralize Farcaster-only verified-share and EXP task UI without touching contracts.
4. Remove the direct dependencies and regenerate the lockfile using the repository's existing package manager.
5. Run scoped typecheck/lint/build checks, then perform an approved browser verification of Base Account, injected wallet, WalletConnect, mint, Arena, Dossier, share buttons, and tasks.

## Decision still needed from Josh

- Keep generic X/Facebook/Web Share controls where they already exist, or remove all social sharing UI in the same release?
- Remove Farcaster-related public documentation now, or make runtime removal first and schedule content cleanup separately?
