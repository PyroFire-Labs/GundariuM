export default function TermsOfService() {
  return (
    <div className="min-h-[calc(100vh-64px)] max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)] mb-8">
        TERMS OF SERVICE
      </h1>
      <p className="text-[var(--foreground)]/60 text-sm mb-8">
        Last updated: March 27, 2026
      </p>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--foreground)]/80 text-sm leading-relaxed">
        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the GundariuM platform (&quot;Service&quot;), including our website, smart contracts, and related services, you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
          </p>
          <p>
            GundariuM is operated by GundariuM (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). The Service is available to users who are at least 18 years of age or the age of majority in their jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">2. Description of Service</h2>
          <p>
            GundariuM is a blockchain-based application on the Base network that allows users to:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Photograph physical Gunpla model kits and mint ERC-721 NFTs (&quot;Gunpla Cards&quot;) with generated combat statistics</li>
            <li>Apply cosmetic upgrades to their Gunpla Cards (frame skins, decals, color modifications, AI-generated repaints)</li>
            <li>Participate in PVE and PVP battles using their Gunpla Cards</li>
            <li>Stake and earn GNDM tokens</li>
            <li>Trade and transfer Gunpla Cards on compatible marketplaces</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">3. Wallet and Blockchain Interactions</h2>
          <p>
            The Service requires a compatible cryptocurrency wallet (e.g., MetaMask, WalletConnect, or Farcaster embedded wallet) to interact with the Base blockchain. You are solely responsible for:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Maintaining the security of your wallet and private keys</li>
            <li>All transactions initiated from your wallet</li>
            <li>Any gas fees or transaction costs incurred on the blockchain</li>
            <li>Ensuring you have sufficient funds (USDC, ETH, GNDM) for transactions</li>
          </ul>
          <p>
            We do not have access to your private keys and cannot reverse, cancel, or refund blockchain transactions. All transactions on the blockchain are final and irreversible.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">4. NFT Minting and Ownership</h2>
          <p>
            When you mint a Gunpla Card, you pay a minting fee in USDC. Upon successful minting, you receive an ERC-721 token on the Base blockchain. Ownership of a Gunpla Card grants you:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>The right to use, display, and transfer the NFT</li>
            <li>The right to use the NFT within the GundariuM game ecosystem</li>
            <li>The right to apply cosmetic modifications to your card</li>
          </ul>
          <p>
            You retain ownership of the original photograph you upload. By uploading a photo, you represent that you own or have the right to use the image and grant us a license to store, process, and display it as part of your NFT metadata on IPFS.
          </p>
          <p>
            Combat statistics, rarity, and traits are generated algorithmically at mint time and cannot be modified after minting. Cosmetic features are separate from combat traits.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">5. Cosmetic Upgrades and Payments</h2>
          <p>
            Cosmetic upgrades (frame skins, decals, color modifications) are paid features priced in USDC. AI-generated repaints are a premium feature with separate pricing. All cosmetic payments are processed on-chain and are non-refundable.
          </p>
          <p>
            We reserve the right to modify cosmetic pricing, add or remove cosmetic options, and update the available cosmetic catalog at any time.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">6. GNDM Token</h2>
          <p>
            GNDM is a utility token used within the GundariuM ecosystem for staking, battle entry fees, and rewards. GNDM is not an investment, security, or financial instrument. We make no representations regarding the future value of GNDM tokens.
          </p>
          <p>
            Staking GNDM involves a 24-hour lock period. Unstaking and reward claiming are subject to smart contract rules that cannot be overridden.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">7. User Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Upload images that are obscene, illegal, infringing, or harmful</li>
            <li>Attempt to exploit, hack, or manipulate the smart contracts or game mechanics</li>
            <li>Use bots, scripts, or automated tools to gain unfair advantage</li>
            <li>Engage in market manipulation of GNDM tokens or Gunpla Cards</li>
            <li>Impersonate other users or misrepresent your identity</li>
            <li>Circumvent any access restrictions or security measures</li>
          </ul>
          <p>
            We reserve the right to restrict access to the Service for users who violate these terms. On-chain assets remain yours regardless of platform access restrictions.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">8. Intellectual Property</h2>
          <p>
            The GundariuM brand, logo, card frame designs, website design, and game mechanics are owned by us. &quot;Gundam,&quot; &quot;Gunpla,&quot; and related names and designs are trademarks of Bandai Namco and Sunrise. GundariuM is a fan-created project and is not affiliated with, endorsed by, or sponsored by Bandai Namco, Sunrise, or any official Gundam rights holders.
          </p>
          <p>
            Users retain ownership of their uploaded photographs. AI-generated cosmetic modifications become part of the NFT metadata stored on IPFS.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">9. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Continuous, uninterrupted access to the Service</li>
            <li>The value, liquidity, or marketability of any NFT or token</li>
            <li>That smart contracts are free from bugs or vulnerabilities</li>
            <li>The availability of IPFS-hosted content indefinitely</li>
            <li>The accuracy of AI-generated cosmetic modifications</li>
          </ul>
          <p>
            Blockchain technology and digital assets carry inherent risks including but not limited to smart contract bugs, network congestion, regulatory changes, and loss of access to wallets.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF FUNDS, LOSS OF DATA, LOSS OF ACCESS TO WALLETS, OR LOSS OF PROFITS, ARISING FROM YOUR USE OF THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">11. Indemnification</h2>
          <p>
            You agree to indemnify and hold us harmless from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">12. Modifications</h2>
          <p>
            We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated date. Your continued use of the Service after changes constitutes acceptance of the modified Terms.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">13. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles. Any disputes arising from these Terms shall be resolved through binding arbitration.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">14. Contact</h2>
          <p>
            For questions about these Terms, contact us at:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Email: <a href="mailto:joshgrubbs@gundarium.xyz" className="text-[var(--accent)] hover:underline">joshgrubbs@gundarium.xyz</a></li>
            <li>X (Twitter): <a href="https://x.com/gundariumgame" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">@gundariumgame</a></li>
            <li>Farcaster: through our official channel</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
