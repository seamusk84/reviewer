// components/Header.tsx
export default function Header() {
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href="/">StreetSage</a>
        <nav className="nav">
          <a href="/">Home</a>
          <a href="/admin/moderate">Moderate</a>
        </nav>
      </div>
    </header>
  );
}
