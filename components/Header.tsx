import Link from "next/link";

export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <span className="brand-badge">SS</span>
          StreetSage
        </Link>

        <nav className="header-nav">
          <a href="/#browse">Browse</a>
          <a href="/#how-it-works">How it works</a>
          <Link href="/admin/moderate" className="header-cta">Moderate</Link>
        </nav>
      </div>
    </header>
  );
}
