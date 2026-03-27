export default function PrivacyPolicy() {
  return (
    <div className="min-h-[calc(100vh-64px)] max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)] mb-8">
        PRIVACY POLICY
      </h1>
      <p className="text-[var(--foreground)]/60 text-sm mb-8">
        Last updated: March 27, 2026
      </p>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--foreground)]/80 text-sm leading-relaxed">
        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">1. Introduction</h2>
          <p>
            GundariuM (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data when you use the GundariuM platform (&quot;Service&quot;).
          </p>
          <p>
            GundariuM is a decentralized application. We do not require account creation, email addresses, or personal identification to use the Service. Your primary identifier is your blockchain wallet address.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">2. Information We Collect</h2>

          <h3 className="text-sm font-bold text-[var(--foreground)] mt-4 mb-2">Information You Provide</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Photographs:</strong> Images of Gunpla model kits you upload for minting. These are stored on IPFS (InterPlanetary File System), a decentralized storage network, not on our servers.</li>
            <li><strong>Wallet Address:</strong> Your public blockchain wallet address, used to identify your on-chain assets and interactions. This is publicly visible on the blockchain by design.</li>
          </ul>

          <h3 className="text-sm font-bold text-[var(--foreground)] mt-4 mb-2">Information Collected Automatically</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Blockchain Data:</strong> All transactions (minting, cosmetic purchases, staking, battles) are recorded on the Base blockchain and are publicly accessible. This is inherent to blockchain technology and not controlled by us.</li>
            <li><strong>Basic Analytics:</strong> We may collect anonymous usage data such as page views, feature usage, and error reports through privacy-friendly analytics to improve the Service. No personally identifiable information is collected through analytics.</li>
          </ul>

          <h3 className="text-sm font-bold text-[var(--foreground)] mt-4 mb-2">Information We Do NOT Collect</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Names, email addresses, or phone numbers</li>
            <li>Government-issued identification</li>
            <li>Private keys or wallet seed phrases</li>
            <li>Location data (beyond what your IP address reveals)</li>
            <li>Cookies for tracking or advertising purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">3. How We Use Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Photo Processing:</strong> Your uploaded photos are processed to generate the card frame composite image, which is then stored on IPFS as part of your NFT metadata.</li>
            <li><strong>AI Cosmetics:</strong> If you purchase AI repaint cosmetics, your card photo is sent to a third-party AI image generation service (Google Gemini) to produce the modified image. The original and modified images are stored on IPFS.</li>
            <li><strong>NFT Metadata:</strong> Your card traits, statistics, and image are compiled into metadata stored on IPFS and referenced by the on-chain NFT.</li>
            <li><strong>Service Improvement:</strong> Anonymous usage data helps us improve game mechanics, UI, and performance.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>IPFS / Pinata:</strong> Decentralized storage for NFT images and metadata. Content stored on IPFS is public and persistent.</li>
            <li><strong>Base Blockchain (Coinbase):</strong> All NFTs, tokens, and transactions exist on the Base L2 network. Blockchain data is public and immutable.</li>
            <li><strong>WalletConnect:</strong> Wallet connection protocol. WalletConnect may collect connection metadata per their own privacy policy.</li>
            <li><strong>Farcaster:</strong> Social protocol integration for miniapp functionality. Farcaster handles its own user data per its privacy policy.</li>
            <li><strong>Google Gemini:</strong> AI image generation for cosmetic repaints. Photos sent for AI processing are subject to Google&apos;s privacy policy and data handling practices.</li>
            <li><strong>Vercel:</strong> Website hosting. Vercel may collect standard server logs (IP addresses, request timestamps) per their privacy policy.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">5. Data Storage and Retention</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>On-Chain Data:</strong> Blockchain data is permanent and cannot be deleted. This includes your wallet address, transaction history, NFT ownership, and card traits.</li>
            <li><strong>IPFS Data:</strong> Images and metadata stored on IPFS are designed to be persistent and publicly accessible. While we can unpin content from our IPFS node, copies may exist on other IPFS nodes.</li>
            <li><strong>Server Data:</strong> We do not maintain a user database. Any temporary server-side data (image processing buffers) is discarded after the request completes.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">6. Your Rights</h2>
          <p>
            Because we collect minimal personal data and most data exists on public blockchains or decentralized storage:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Access:</strong> All your on-chain data is publicly accessible on the Base blockchain. Your IPFS content is accessible via its content hash.</li>
            <li><strong>Portability:</strong> Your NFTs and tokens are standard ERC-721 and ERC-20 tokens that you can transfer, sell, or use on any compatible platform.</li>
            <li><strong>Deletion:</strong> Due to the immutable nature of blockchain technology, on-chain data cannot be deleted. We can unpin IPFS content from our node upon request, but this does not guarantee removal from the IPFS network.</li>
          </ul>
          <p>
            If you have specific privacy concerns or requests, contact us through our official channels.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">7. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for use by anyone under the age of 18. We do not knowingly collect information from children. Cryptocurrency and NFT transactions require a wallet, which inherently requires the user to be of legal age in their jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">8. Security</h2>
          <p>
            We implement reasonable security measures to protect the Service. However:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>We never have access to your private keys or wallet credentials</li>
            <li>Smart contracts are auditable on-chain but may contain undiscovered vulnerabilities</li>
            <li>IPFS content is public by design</li>
            <li>No system is 100% secure — use the Service at your own risk</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">9. International Users</h2>
          <p>
            The Service is accessible globally. By using the Service, you consent to the processing of your data as described in this policy. Different jurisdictions may have different data protection laws — you are responsible for ensuring your use of the Service complies with your local regulations.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg text-[var(--foreground)] mb-3">11. Contact</h2>
          <p>
            For privacy-related questions or requests, contact us through our official channels on Farcaster or at the links provided on our website.
          </p>
        </section>
      </div>
    </div>
  );
}
