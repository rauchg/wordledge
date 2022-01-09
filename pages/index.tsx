import { useState, useEffect, useRef, MouseEvent } from "react";
import { useRouter } from "next/router";
import settings from "../settings.json";
import toast, { Toaster } from "react-hot-toast";
import useWindowSize from "react-use/lib/useWindowSize";
import Confetti from "react-confetti";
import copy from "copy-text-to-clipboard";
import type { GameState, GameStateRow, GameStateRowItem, GameStateRows, ServerResponse } from "../types";

const { GAME_ID, BOARD_SIZE, WORD_LENGTH } = settings;

type CheckOptions = {
  signal?: AbortSignal
};

async function check(word: string, opts: CheckOptions) {
  const res = await fetch(`/check?word=${encodeURIComponent(word)}`, opts);
  return await res.json();
}

function readGameStateFromStorage() {
  let state = [];
  try {
    const storedState = JSON.parse(localStorage.getItem("gameState"));
    if (storedState) {
      if (storedState.gameId === GAME_ID) {
        state = storedState.state;
      } else {
        localStorage.removeItem("gameState");
      }
    }
  } catch (err) {
    console.error("state restore error", err);
    localStorage.removeItem("gameState");
  }
  return state;
}

function saveGameStateToStorage(state: GameStateRows) {
  try {
    localStorage.setItem(
      "gameState",
      JSON.stringify({
        gameId: GAME_ID,
        state: state,
      })
    );
  } catch (err) {
    console.error("state save error", err);
  }
}

function getIsGameOver (gameState: GameState) {
  return gameState && (gameState.state.length === 6 || getIsVictory(gameState));
}

function getIsVictory (gameState: GameState) {
  return gameState
  && gameState.state.length
  && !gameState.state[gameState.state.length - 1].some(
    (i : GameStateRowItem) => i.score !== "good"
  );
}

type ClipboardContent = {
  'text/plain': string,
  'text/html': string,
};

async function copyToClipboard(obj : ClipboardContent) : Promise<boolean> {
  if (navigator.clipboard && 'undefined' !== typeof ClipboardItem) {
    const item = new ClipboardItem({
      ['text/plain']: new Blob([obj['text/plain']], { type: 'text/plain' }),
      ['text/html']: new Blob([obj['text/html']], { type: 'text/html' }),
    });
    try {
      await navigator.clipboard.write([item]);
    } catch (err) {
      console.error("clipboard write error", err);
      return false;
    }
    return true;
  } else {
    return copy(obj['text/plain']);
  }
}

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(null);
  const fetchControllerRef = useRef(null);
  const hiddenInputRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const { width, height } = useWindowSize();
  const isGameOver = getIsGameOver(gameState);

  useEffect(() => {
    if (gameState == null) {
      setGameState({ state: readGameStateFromStorage(), initial: true });
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState && !gameState.initial) {
      saveGameStateToStorage(gameState.state);
    }
  }, [gameState]);

  useEffect(() => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    toast.dismiss("toast");
  }, [inputText]);

  useEffect(() => {
    window.addEventListener('storage', (e) => {
      if (e.key === "gameState") {
        setGameState({ state: readGameStateFromStorage(), initial: false });
      }
    });
  }, []);

  const router = useRouter();
  const {query} = router;
  useEffect(() => {
    if ('reset' in query) {
      router.replace('/');
      setGameState({ state: [], initial: false });
    }
  }, [router, query]);

  function onClick(ev: MouseEvent) {
    ev.preventDefault();
    setGameState((gameState: GameState) => {
      if (gameState) {
        if (!getIsGameOver(gameState)) {
          if (hiddenInputRef.current && hiddenInputRef.current != document.activeElement) {
            hiddenInputRef.current.focus();
          }
        }
      }
      return gameState;
    });
  }

  function onInputFocus() {
    setIsFocused(true);
  }

  function onInputBlur() {
    setIsFocused(false);
  }

  function getShareText(gameState: GameState, html = false) {
    const text = `${(html ? '<a href="https://wordledge.vercel.app">Wordledge</a>' : 'Wordledge.vercel.app')} #${GAME_ID} ${
      getIsVictory(gameState) ? gameState.state.length : "X"
    }/${BOARD_SIZE}

${gameState.state
  .map((line: GameStateRow) => {
    return line
      .map((item) => {
        return item.score === "good"
          ? "🟩"
          : item.score === "off"
          ? "🟨"
          : "⬛️";
      })
      .join("");
  })
  .join("\n")}`;
    if (html) {
      return text.replace(/\n/g, "<br>");
    } else {
      return text;
    }
  }

  function onCopyToClipboard(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setGameState((gameState: GameState) => {
      if (gameState) {
        copyToClipboard({
          'text/plain': getShareText(gameState),
          'text/html': getShareText(gameState, true)
        }).then((ok) => {
          if (ok) {
            toast.success("Copied!", { id: "clipboard" });
          } else {
            toast.error("Clipboard error", { id: "clipboard" });
          }
        });
      }
      return gameState;
    });
  }

  async function submit(text: string) {
    if (fetchControllerRef.current) fetchControllerRef.current.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    setIsLoading(true);
    toast.loading("Checking…", { id: "toast", duration: Infinity });

    let serverResponse : ServerResponse;
    try {
      serverResponse = await check(text, { signal: controller.signal });
    } catch (err) {
      if (err.name === "AbortError") {
        toast.dismiss("toast");
      } else {
        toast.error("Unknown error", { id: "toast" });
      }
      return;
    } finally {
      setIsLoading(false);
      fetchControllerRef.current = null;
    }

    let { error, match } = serverResponse;

    if (error) {
      if (error === "unknown_word") {
        toast.error("Invalid English word", { id: "toast", duration: 1000 });
      } else if (error === "api_error") {
        toast.error("Dictionary API error", { id: "toast" });
      }
    } else {
      toast.dismiss("toast");
      setInputText("");
      if (!match.some((i: GameStateRowItem) => i.score !== "good")) {
        setShowConfetti(true);
      }
      setGameState((state: GameState) => {
        return {
          state: state.state.concat([match]),
          initial: false,
        };
      });
    }
  }

  useEffect(() => {
    function handleKeyDown(ev: KeyboardEvent) {
      if (fetchControllerRef.current || isGameOver) return;
      if (ev.key === "Enter") {
        setInputText((text) => {
          if (!fetchControllerRef.current && text.length === 5) {
            submit(text);
          }
          return text;
        });
      } else if (/^[a-z]$/i.test(ev.key)) {
        if (ev.metaKey || ev.altKey || ev.ctrlKey) return;
        // in non-ios keyboard input is possible without input focus
        // so we force it to be focused
        setIsFocused(true);
        setInputText((text) =>
          (text + ev.key.toLowerCase()).slice(0, WORD_LENGTH)
        );
      } else if (ev.key === "Backspace") {
        // in non-ios keyboard input is possible without input focus
        // so we force it to be focused
        setIsFocused(true);
        setInputText((text) =>
          ev.metaKey ? "" : text.slice(0, text.length - 1)
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGameOver]);

  return (
    <main className={`${!gameState ? "initializing" : ""}`} onClick={onClick}>
      <input
        className="hidden-input"
        onFocus={onInputFocus}
        onBlur={onInputBlur}
        ref={hiddenInputRef}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck="false"
        enterKeyHint="go"
      />

      <div
        className={`board
          ${isLoading ? "loading" : ""}
        `}
      >
        {gameState &&
          gameState.state.map((match: GameStateRow, i: Number) => (
            <div key={`gs_row${i}`} className="row">
              {match.map((item : GameStateRowItem, i: Number) => {
                return (
                  <div key={`letter-${i}`} className={`letter ${item.score}`}>
                    {item.letter}
                  </div>
                );
              })}
            </div>
          ))}

        {gameState && gameState.state.length < BOARD_SIZE
          ? Array.from({ length: 6 - gameState.state.length }, (_, i) => {
              if (i === 0 && !isGameOver) {
                return (
                  <div key="row_input" className="row input">
                    {inputText
                      .padEnd(5, "?")
                      .split("")
                      .map((letter, index) => (
                        <div
                          key={index}
                          className={`letter ${
                            isFocused &&
                            index ===
                              Math.min(
                                Math.max(0, inputText.length),
                                WORD_LENGTH - 1
                              )
                              ? "focus"
                              : ""
                          }`}
                        >
                          {letter === "?" ? null : letter}
                        </div>
                      ))}
                  </div>
                );
              } else {
                return (
                  <div key={`row_${i}`} className="row disabled">
                    <div className="letter"></div>
                    <div className="letter"></div>
                    <div className="letter"></div>
                    <div className="letter"></div>
                    <div className="letter"></div>
                  </div>
                );
              }
            })
          : null}

        {isGameOver ? (
          <div className="summary-wrapper">
            <div className={`summary ${!gameState.initial ? "animate" : ""}`}>
              <h1>Game summary</h1>
              <div className="share-text" onClick={(e) => e.stopPropagation()}>
                {getShareText(gameState)}
              </div>

              <button onClick={onCopyToClipboard}>📋 Copy to clipboard</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="footer" onClick={(e) => e.stopPropagation()}>
        Deployed on <a href="https://vercel.com" target="_blank" rel="noreferrer">Vercel</a> (<a href="https://github.com/rauchg/wordledge" rel="noreferrer" target="_blank">source</a>) <span>|</span>{" "}
        Inspired by <a href="https://www.powerlanguage.co.uk/wordle/" rel="noreferrer" target="_blank">Wordle</a>
      </div>

      <Toaster />
      {showConfetti ? (
        <Confetti
          numberOfPieces={300}
          recycle={false}
          width={width}
          height={height}
        />
      ) : null}

      <style jsx>{`
        main {
          color: #fff;
          width: 100vw;
          height: 100vh;
          height: -webkit-fill-available;
          user-select: none;
          transition: all 0.2s ease-in-out;
        }

        main.initializing {
          opacity: 0;
        }

        .hidden-input {
          background: #fff;
          color: #000;
          position: absolute;
          left: -100000px;
          font-size: 16px; /* prevent zoom on ios safari */
        }

        .board {
          transition: all 0.2s ease-in-out;
          position: relative;
        }

        .summary-wrapper {
          position: absolute;
          top: 0;
          height: 100%;
          margin: auto;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary {
          width: 250px;
          background: rgba(0, 0, 0, 0.7);
          text-align: center;
          padding: 15px;
        }

        .summary.animate {
          opacity: 0;
          transform: translateY(-30px);
          animation: appear 200ms ease-out forwards;
          animation-delay: 700ms;
        }

        @keyframes appear {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .summary h1 {
          font-size: 16px;
          margin-top: 0;
          margin-bottom: 20px;
        }

        .summary .share-text {
          margin-bottom: 20px;
          font-size: 14px;
          background: #fff;
          color: #000;
          user-select: all;
          padding: 10px;
          white-space: pre-wrap;
          line-height: 14px;
          border: 3px solid #000;
        }

        .summary button {
          padding: 5px;
          background: #fff;
          color: #000;
          border: 1px solid #000;
          cursor: pointer;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          font-weight: bold;
          text-transform: uppercase;
          background: cyan;
        }

        .summary button:active {
          background-color: #00b5b5;
        }

        .board.loading {
          filter: blur(5px);
          cursor: progress;
        }

        .row,
        .letter {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .letter {
          width: 55px;
          height: 53px;
          background-color: #fff;
          font-size: 34px;
          font-weight: bold;
          text-transform: uppercase;
          margin: 3px;
          color: #000;
        }
        .letter.bad {
          background-color: #ccc;
        }
        .letter.good {
          background-color: #0f0;
        }
        .letter.off {
          background-color: yellow;
        }
        .letter.focus {
          box-shadow: 0 0 3px 3px cyan;
        }
        .row.disabled .letter {
          background-color: #666;
        }

        .footer {
          color: #999;
          font-size: 12px;
          text-align: center;
          padding: 3px 0;
        }
        .footer span {
          color: #666;
        }
        .footer a {
          text-decoration: underline;
        }
        .footer a:hover {
          color: #ccc;
        }
      `}</style>
    </main>
  );
}
