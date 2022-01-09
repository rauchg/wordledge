import "../styles/globals.css";
import Head from "next/head";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Wordledge: Wordle on Next.js at the Edge</title>
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@rauchg" />
        <meta
          name="twitter:title"
          content="Wordledge: Wordle on Next.js at the Edge"
        />
        <meta
          property="og:description"
          content="A spinoff of the popular Wordle game written in Next.js"
        />
        <meta
          property="og:image"
          content="https://wordledge.vercel.app/card.png"
        />
        <meta
          name="twitter:image"
          content="https://wordledge.vercel.app/card.png"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
