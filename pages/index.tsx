// pages/index.tsx
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>StreetSage</title>
        <meta name="description" content="Local Views, True Reviews" />
      </Head>

      {/* Header */}
      <header style={{ background: "#f7f4fb", padding: "0.75rem 1rem" }}>
        <div
          style={{
            maxWidth: "1000px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                background: "purple",
                color: "white",
                padding: "0.4rem",
                borderRadius: "8px",
              }}
            >
              🏠
            </span>
            <h1 style={{ fontSize: "1.25rem", margin: 0 }}>StreetSage</h1>
          </div>
          <nav>
            <a href="/" style={{ marginRight: "1rem" }}>
              Home
            </a>
            <a href="/moderate">Moderate</a>
          </nav>
        </div>
      </header>

      {/* Tagline bar */}
      <div
        style={{
          background: "#efe9ff",
          textAlign: "center",
          padding: "0.25rem",
          fontSize: "0.9rem",
        }}
      >
        Local Views, <strong>True Reviews</strong>
      </div>

      {/* Main content */}
      <main style={{ maxWidth: "720px", margin: "2rem auto", padding: "1rem" }}>
        <h2>StreetSage</h2>
        <p>Pick a county and town to see available estates.</p>

        {/* 👉 This is where we’ll later drop in <EstatePicker /> */}
      </main>
    </>
  );
}
