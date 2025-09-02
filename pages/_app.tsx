// pages/_app.tsx
import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ireland Estate Reviews</title>
        <meta
          name="description"
          content="Unfiltered reviews of estates and areas across Ireland. Search by county, town, and estate."
        />
        <meta name="theme-color" content="#0b1020" />
        {/* Open Graph / Twitter */}
        <meta property="og:title" content="Ireland Estate Reviews" />
        <meta
          property="og:description"
          content="Unfiltered reviews of estates and areas across Ireland."
        />
        <meta property="og:image" content="/icon.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="site">
        <header className="site-header">
          <div className="container inner">
            <a className="brand" href="/">
              <span className="dot" />
              Ireland Estate Reviews
            </a>
            <nav className="nav">
              <a href="/">Search</a>
              <a href="mailto:hello@example.com">Contact</a>
            </nav>
          </div>
        </header>

        <main className="site-main">
          <div className="container">
            <Component {...pageProps} />
          </div>
        </main>

        <footer className="footer">
          <div className="container small">
            © {new Date().getFullYear()} Ireland Estate Reviews · Built with Next.js
          </div>
        </footer>
      </div>
    </>
  );
}
