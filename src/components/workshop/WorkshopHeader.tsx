import Link from "next/link";

export function WorkshopHeader() {
  return (
    <header className="workshop-header">
      <div>
        <p className="workshop-eyebrow">PyroFire Labs / Virtual Kit System</p>
        <h1>GUNDARIU<span>M</span> WORKSHOP</h1>
      </div>
      <nav aria-label="Workshop destinations" className="workshop-destinations">
        <a href="#gallery">Gallery</a>
        <Link href="/arena">Arena</Link>
        <Link href="/mint">Mint</Link>
        <Link href="/collection">Collection</Link>
      </nav>
    </header>
  );
}
