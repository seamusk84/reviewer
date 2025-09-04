// components/Header.tsx
export default function Header() {
  return (
    <>
      {/* Tagline Bar */}
      <div className="tagline-bar" role="note" aria-label="slogan">
        <div className="wrap">
          <span className="tagline">
            Local Views, <strong>True Reviews</strong>
          </span>
        </div>
      </div>

      {/* Main Header */}
      <header className="site-header">
        <div className="wrap row">
          <a className="brand" href="/" aria-label="StreetSage home">
            <span className="logo-box" aria-hidden="true">
              {/* House outline icon */}
              <svg
                className="logo-icon"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Roof */}
                <path d="M3 11.5L12 4l9 7.5" />
                {/* House body */}
                <path d="M5.5 10.5v9h13v-9" />
                {/* Door */}
                <path d="M10.5 19.5v-4.5h3v4.5" />
              </svg>
            </span>
            <span className="brand-text">StreetSage</span>
          </a>

          <nav className="nav" aria-label="Primary">
            <a href="/">Home</a>
            <a href="/admin/moderate">Moderate</a>
          </nav>
        </div>
      </header>
    </>
  );
}
