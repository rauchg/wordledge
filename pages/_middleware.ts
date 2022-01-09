import { NextResponse } from "next/server";

const WORD = process.env.WORD || "rauch";

export default async function middleware(req) {
  if (req.nextUrl.pathname === "/check") {
    const word = req.nextUrl.searchParams
      .get("word")
      .toLowerCase()
      .slice(0, WORD.length);

    // if the word doesn't match, assert it's a
    // dictionary word
    if (word !== WORD) {
      let matchingWords;
      try {
        const wordsRes = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
            word
          )}`
        );
        matchingWords = await wordsRes.json();
      } catch (err) {
        console.error("api error", err.stack);
        return NextResponse.json({ error: "api_error" });
      }

      if (!matchingWords.length) {
        return NextResponse.json({
          error: "unknown_word",
        });
      }
    }

    return NextResponse.json({
      match: word.split("").map((letter, i) => {
        return {
          letter: letter,
          score:
            letter === WORD[i] ? "good" : WORD.includes(letter) ? "off" : "bad",
        };
      }),
    });
  } else {
    return null;
  }
}
