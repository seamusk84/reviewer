import type { AppProps } from "next/app";
import Head from "next/head";
import "@/styles/globals.css";
import Header from "@/components/Header";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <title>StreetSage — Estate reviews across Ireland</title>
      </Head>

      <Header />

      <main className="container">
        <Component {...pageProps} />
      </main>

      <footer className="site-footer">
        <div className="container">
          © {new Date().getFullYear()} StreetSage — Community-powered estate reviews.
        </div>
      </footer>
    </>
  );
}
