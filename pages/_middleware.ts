import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WORD = process.env.WORD || "rauch";

// e.g.: https://api.dictionaryapi.dev/api/v2/entries/en/test
type DictionaryApiWord = {
  word: string;
}

export default async function middleware(req : NextRequest) : Promise<NextResponse> {
  if (req.nextUrl.pathname === "/check") {
    const word = req.nextUrl.searchParams
      .get("word")
      .toLowerCase()
      .slice(0, WORD.length);

    // if the word doesn't match, assert it's a
    // dictionary word
    if (word !== WORD) {
      let matchingWords : Array<DictionaryApiWord>;
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

    const lettersToCheck = WORD.split("")
    const match = word.split("").map((letter) => (
      {
        letter: letter,
        score: "bad"
      }
    ))
    word.split("").forEach((letter, i) => {
      if (WORD[i] === letter) {
        match[i].score = "good"
        lettersToCheck.splice(i, 1)
      }
    })
    word.split("").forEach((letter, i) => {
      if (lettersToCheck.includes(letter) && match[i].score !== "good") {
        match[i].score = "off"
        lettersToCheck.splice(lettersToCheck.indexOf(letter), 1)
      }
    })

    return NextResponse.json({
      match
    });
  } else {
    return null;
  }
}
