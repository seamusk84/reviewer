// pages/_app.tsx
import type { AppProps } from "next/app";
import Head from "next/head";

// ⬇️ change these two lines:
import "../styles/globals.css";
import Header from "../components/Header";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>StreetSage</title>
      </Head>
      <Header />
      <main className="container">
        <Component {...pageProps} />
      </main>
    </>
  );
}
