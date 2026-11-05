"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  answerQuestion,
  answerThisOrThat,
  drawLine,
  flipCard,
  guessLetter,
  newBoxes,
  newChichiWord,
  newGrid,
  newLadder,
  newMemory,
  newThisOrThat,
  newTicTacToe,
  newWordGuess,
  passTurn,
  pickRps,
  playGrid,
  playTicTacToe,
  rollLadder,
  wordTimeout,
} from "@/app/(app)/games-actions";
import { BOX_N, GRID, JUMPS, LIVES, MEMORY_SIZES, PAIRS, TTT_LINES, TURN_SECS, WORD_LENGTHS, WORD_TIME, type GridKind, type RpsPick } from "@/lib/games-content";
import { Emote, type EmoteName } from "@/components/emote";

type Res = { ok: boolean; error?: string } | undefined;

function useAct() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (r && !r.ok && r.error) setErr(r.error);
    });
  return { pending, err, run };
}

const Err = ({ e }: { e: string | null }) => (e ? <p className="text-[13px] font-bold text-coral">{e}</p> : null);

/* ============================ shared pieces ============================ */

/** A big friendly status line with a little face that matches the moment. */
function Banner({ text, mood, hot = false }: { text: string; mood: EmoteName; hot?: boolean }) {
  return (
    <div key={text} className={`pop-in flex items-center gap-2 rounded-full border-2 border-ink py-1 pl-1 pr-4 text-[14px] font-extrabold shadow-[0_3px_0_#2E2240] ${hot ? "bg-sun" : "bg-white"}`}>
      <Emote name={mood} size={32} animate />
      <span>{text}</span>
    </div>
  );
}

function BigBtn({ children, onClick, pending, tone = "bg-sun" }: { children: React.ReactNode; onClick: () => void; pending?: boolean; tone?: string }) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`press h-12 rounded-2xl border-2 border-ink px-6 text-[16px] font-extrabold shadow-[0_4px_0_#2E2240] active:translate-y-[3px] active:shadow-[0_1px_0_#2E2240] disabled:opacity-60 ${tone}`}
    >
      {children}
    </button>
  );
}

/** Little segmented picker for game options. */
function Seg<T extends number | string>({ label, value, options, onChange, show }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void; show: (v: T) => string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[12px] font-extrabold text-ink-soft">{label}</span>
      <div className="flex flex-wrap justify-center gap-1 rounded-full bg-cream p-1">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full px-3 py-1 text-[13px] font-extrabold transition ${value === o ? "bg-ink text-cream shadow" : "text-ink-soft"}`}
          >
            {show(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

const secsLabel = (s: number) => (s ? `${s}s` : "Off");

/** Confetti made of hearts, peaches and stars, for the winner's screen. */
export function Confetti({ run }: { run: boolean }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: (i * 37) % 100,
        x: `${((i * 53) % 40) - 20}vw`,
        r: `${360 + ((i * 97) % 540)}deg`,
        d: `${2 + ((i * 13) % 14) / 10}s`,
        delay: `${((i * 7) % 10) / 20}s`,
        kind: i % 4,
        color: ["#FF6B6B", "#FFD24D", "#7BD3A8", "#B39CFF", "#FF9ECF", "#7CC4FF"][i % 6],
      })),
    [],
  );
  if (!run) return null;
  return (
    <div aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{ left: `${b.left}%`, ["--x" as string]: b.x, ["--r" as string]: b.r, ["--d" as string]: b.d, ["--delay" as string]: b.delay }}
        >
          <svg width={18} height={18} viewBox="-10 -10 20 20">
            {b.kind === 0 && <path d="M0 6 C-8 0 -4 -8 0 -3 C4 -8 8 0 0 6 Z" fill={b.color} stroke="#2E2240" strokeWidth={1.2} />}
            {b.kind === 1 && <circle r={6} fill="#FFB38A" stroke="#2E2240" strokeWidth={1.2} />}
            {b.kind === 2 && <path d="M0 -7 L2 -2 7 -2 3 1.5 4.5 7 0 4 -4.5 7 -3 1.5 -7 -2 -2 -2 Z" fill={b.color} stroke="#2E2240" strokeWidth={1} />}
            {b.kind === 3 && <rect x={-5} y={-3} width={10} height={6} rx={2} fill={b.color} />}
          </svg>
        </span>
      ))}
    </div>
  );
}

/** Ring that runs down while it's someone's turn. At zero, the turn passes. */
function TurnTimer({ id, secs, since, active }: { id: string; secs: number; since: string; active: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null); // client only, so the server and phone never disagree
  const fired = useRef("");
  useEffect(() => {
    if (!secs || !active) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [secs, active]);
  const left = now == null ? secs * 1000 : Math.max(0, secs * 1000 - (now - new Date(since).getTime()));
  useEffect(() => {
    if (now == null || !secs || !active || left > 0 || fired.current === since) return;
    fired.current = since;
    passTurn(id).then(() => router.refresh());
  }, [now, left, secs, active, since, id, router]);
  if (!secs || !active || now == null) return null;
  const pct = left / (secs * 1000);
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-extrabold" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <svg width={36} height={36} viewBox="0 0 36 36" className="-rotate-90">
        <circle cx={18} cy={18} r={R} fill="white" stroke="#EADFD6" strokeWidth={5} />
        <circle cx={18} cy={18} r={R} fill="none" stroke={pct < 0.3 ? "#FF6B6B" : "#7BD3A8"} strokeWidth={5} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <span className={`tabular-nums ${pct < 0.3 ? "text-coral" : ""}`}>{Math.ceil(left / 1000)}s</span>
    </span>
  );
}

type Turn = { meId: string; partner: string };
function outcome(done: boolean, winner: string | null, meId: string, myTurn: boolean, partner: string, idle: string): { text: string; mood: EmoteName; hot: boolean } {
  if (done) return winner === meId ? { text: "You won!", mood: "party", hot: true } : winner ? { text: `${partner} won this one. Rematch?`, mood: "angry", hot: false } : { text: "It's a draw!", mood: "hug", hot: false };
  return myTurn ? { text: idle, mood: "wink", hot: true } : { text: `Waiting for ${partner}`, mood: "think", hot: false };
}

/* ============================ Tic tac toe ============================ */

export function TicTacToe({
  game,
  meId,
  partner,
}: Turn & {
  me?: string;
  game: { id: string; board: (string | null)[]; x: string; status: string; turn: string | null; winner: string | null; last: number | null; secs: number; since: string } | null;
}) {
  const { pending, err, run } = useAct();
  const [secs, setSecs] = useState<number>(0);
  const myMark = game ? (game.x === meId ? "x" : "o") : "x";
  const myTurn = game?.status === "active" && game.turn === meId;
  const line = game ? TTT_LINES.find((l) => l.every((i) => game.board[i] && game.board[i] === game.board[l[0]])) : null;
  const o = game ? outcome(game.status === "done", game.winner, meId, myTurn, partner, `Your turn, you're ${myMark === "x" ? "pink X" : "blue O"}`) : null;
  const mark = (c: string | null) =>
    c === "x" ? (
      <svg viewBox="0 0 40 40" className="size-[70%]">
        <path d="M9 9 L31 31 M31 9 L9 31" stroke="#2E2240" strokeWidth={10} strokeLinecap="round" />
        <path d="M9 9 L31 31 M31 9 L9 31" stroke="#FF7FA0" strokeWidth={6} strokeLinecap="round" />
      </svg>
    ) : c === "o" ? (
      <svg viewBox="0 0 40 40" className="size-[70%]">
        <circle cx={20} cy={20} r={12} fill="none" stroke="#2E2240" strokeWidth={10} />
        <circle cx={20} cy={20} r={12} fill="none" stroke="#7CC4FF" strokeWidth={6} />
      </svg>
    ) : null;
  return (
    <div className="flex flex-col items-center gap-3">
      {o && <Banner {...o} />}
      {game && <TurnTimer id={game.id} secs={game.secs} since={game.since} active={game.status === "active"} />}
      {game && (
        <div className="grid grid-cols-3 gap-2 rounded-[26px] border-2 border-ink bg-lilac-soft p-2 shadow-[0_4px_0_#2E2240]" role="grid" aria-label="Tic tac toe board">
          {game.board.map((c, i) => (
            <button
              key={i}
              type="button"
              disabled={!myTurn || !!c || pending}
              onClick={() => run(() => playTicTacToe(game.id, i))}
              aria-label={c ? `Square ${i + 1}: ${c}` : `Square ${i + 1}, empty`}
              className={`flex size-[84px] items-center justify-center rounded-2xl border-2 border-ink transition ${line?.includes(i) ? "win-pulse bg-sun" : "bg-white"} ${myTurn && !c ? "hover:bg-sun-soft" : ""}`}
            >
              {c && <span key={`${game.id}${i}`} className={`flex size-full items-center justify-center ${game.last === i ? "pop-place" : ""}`}>{mark(c)}</span>}
            </button>
          ))}
        </div>
      )}
      {(!game || game.status === "done") && (
        <>
          <Seg label="Turn timer" value={secs} options={TURN_SECS} onChange={setSecs} show={secsLabel} />
          <BigBtn pending={pending} onClick={() => run(() => newTicTacToe(secs))}>
            {game ? "Play again" : "New game"}
          </BigBtn>
        </>
      )}
      {game?.status === "active" && (
        <button type="button" disabled={pending} onClick={() => confirm("Start over?") && run(() => newTicTacToe(game.secs))} className="text-[12px] font-bold text-ink-soft underline">
          Restart
        </button>
      )}
      <Confetti run={game?.status === "done" && game.winner === meId} />
      <Err e={err} />
    </div>
  );
}

/* ============================ Rock paper scissors ============================ */

function Hand({ k, size = 64 }: { k: RpsPick; size?: number }) {
  const skin = "#FFC9A8";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={k} role="img">
      {k === "rock" && (
        <>
          <path d="M14 30 c0 -10 8 -14 18 -14 c12 0 18 6 18 16 c0 10 -7 18 -18 18 c-10 0 -18 -6 -18 -20 Z" fill={skin} stroke="#2E2240" strokeWidth={3} />
          <path d="M22 22 c4 -2 7 0 7 4 M30 20 c4 -2 7 0 7 4 M38 21 c4 -1 6 1 6 5" fill="none" stroke="#2E2240" strokeWidth={2.4} strokeLinecap="round" />
          <ellipse cx={22} cy={40} rx={4} ry={2.4} fill="#FF7FA0" opacity={0.5} />
        </>
      )}
      {k === "paper" && (
        <>
          <path d="M18 54 c-6 -6 -8 -14 -8 -20 c0 -3 4 -4 6 -1 l3 5 V14 a3.5 3.5 0 0 1 7 0 v16 V10 a3.5 3.5 0 0 1 7 0 v20 V12 a3.5 3.5 0 0 1 7 0 v18 v-12 a3.5 3.5 0 0 1 7 0 v22 c0 9 -6 16 -16 16 c-6 0 -10 -2 -13 -4 Z" fill={skin} stroke="#2E2240" strokeWidth={3} strokeLinejoin="round" />
          <ellipse cx={30} cy={44} rx={4} ry={2.4} fill="#FF7FA0" opacity={0.5} />
        </>
      )}
      {k === "scissors" && (
        <>
          <path d="M20 56 c-6 -4 -8 -12 -6 -20 l2 -6 L10 12 a3.6 3.6 0 0 1 6.8 -2.4 L24 26 L26 8 a3.6 3.6 0 0 1 7.2 .6 L32 30 c6 -2 14 0 16 8 c2 9 -4 18 -14 19 c-6 1 -10 0 -14 -1 Z" fill={skin} stroke="#2E2240" strokeWidth={3} strokeLinejoin="round" />
          <path d="M30 40 c3 -2 8 -2 10 1" fill="none" stroke="#2E2240" strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function RockPaperScissors({
  mine,
  theirs,
  done,
  winner,
  meId,
  partner,
}: Turn & {
  mine: RpsPick | null;
  theirs: RpsPick | "hidden" | null;
  done: boolean;
  winner: string | null;
}) {
  const { pending, err, run } = useAct();
  const waiting = mine && !done;
  const picks: RpsPick[] = ["rock", "paper", "scissors"];
  return (
    <div className="flex flex-col items-center gap-3">
      {done && mine && theirs && theirs !== "hidden" ? (
        <>
          <div className="flex items-center gap-3">
            <span className="pop-place flex flex-col items-center text-[12px] font-bold">
              <Hand k={mine} size={86} />
              You
            </span>
            <span className="font-display text-2xl font-bold text-ink-soft">vs</span>
            <span className="pop-place flex flex-col items-center text-[12px] font-bold" style={{ animationDelay: ".15s" }}>
              <span className="inline-block -scale-x-100">
                <Hand k={theirs} size={86} />
              </span>
              {partner}
            </span>
          </div>
          <Banner text={winner === meId ? "You win!" : winner ? `${partner} wins!` : "Draw! Great minds"} mood={winner === meId ? "party" : winner ? "laugh" : "hug"} hot={winner === meId} />
        </>
      ) : (
        <Banner
          text={waiting ? `You picked. Waiting for ${partner}` : theirs === "hidden" ? `${partner} already picked. Your turn!` : "Pick one. It stays secret until you both choose."}
          mood={waiting ? "think" : theirs === "hidden" ? "shock" : "wink"}
          hot={!waiting}
        />
      )}
      {(!mine || done) && (
        <div className="flex gap-2">
          {picks.map((k) => (
            <button
              key={k}
              type="button"
              disabled={pending}
              onClick={() => run(() => pickRps(k))}
              className="press flex size-24 flex-col items-center justify-center rounded-3xl border-2 border-ink bg-white shadow-[0_4px_0_#2E2240] hover:bg-sun-soft active:translate-y-[3px] active:shadow-[0_1px_0_#2E2240]"
              aria-label={k}
            >
              <Hand k={k} size={56} />
              <span className="text-[12px] font-extrabold capitalize">{k}</span>
            </button>
          ))}
        </div>
      )}
      {done && <p className="text-[12px] font-semibold text-ink-soft">Tap one to play another round</p>}
      <Confetti run={done && winner === meId} />
      <Err e={err} />
    </div>
  );
}

/* ============================ This or that ============================ */

export function ThisOrThat({
  game,
  partner,
}: {
  game: { id: string; pairs: number[]; mine: number[] | null; theirs: number[] | null; theyAnswered: boolean; done: boolean } | null;
  partner: string;
}) {
  const { pending, err, run } = useAct();
  const [picks, setPicks] = useState<(number | null)[]>(() => (game ? game.pairs.map(() => null) : []));
  if (!game) {
    return (
      <div className="flex flex-col items-center gap-3">
        <Banner text="6 quick choices each. How much do you match?" mood="love" />
        <BigBtn pending={pending} onClick={() => run(newThisOrThat)}>
          Start a round
        </BigBtn>
        <Err e={err} />
      </div>
    );
  }
  if (game.done && game.mine && game.theirs) {
    const same = game.pairs.filter((_, i) => game.mine![i] === game.theirs![i]).length;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col items-center gap-1">
          <Emote name={same >= 5 ? "love" : same >= 3 ? "happy" : "laugh"} size={70} animate />
          <p className="font-display text-2xl font-semibold">
            {same}/{game.pairs.length} match
          </p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {game.pairs.map((p, i) => {
            const pair = PAIRS[p];
            const ok = game.mine![i] === game.theirs![i];
            return (
              <li key={i} className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2 text-[13px] font-bold ${ok ? "border-leaf bg-mint-soft" : "border-transparent bg-cream"}`}>
                <span>You: {pair[game.mine![i]]}</span>
                <span className="text-right">
                  {partner}: {pair[game.theirs![i]]}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mx-auto">
          <BigBtn pending={pending} onClick={() => run(newThisOrThat)}>
            New round
          </BigBtn>
        </div>
        <Err e={err} />
      </div>
    );
  }
  if (game.mine) return <Banner text={`Your answers are in. Waiting for ${partner}`} mood="think" />;
  return (
    <div className="flex flex-col gap-2">
      {game.theyAnswered && <Banner text={`${partner} already answered. Your turn!`} mood="shock" hot />}
      {game.pairs.map((p, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          {PAIRS[p].map((opt, j) => (
            <button
              key={j}
              type="button"
              onClick={() => setPicks((x) => x.map((v, k) => (k === i ? j : v)))}
              className={`press h-12 rounded-2xl border-2 text-[14px] font-bold transition ${picks[i] === j ? "border-ink bg-ink text-cream" : "border-ink/20 bg-white"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      ))}
      <div className="mx-auto mt-1">
        <BigBtn pending={pending || picks.some((p) => p === null)} onClick={() => run(() => answerThisOrThat(game.id, picks as number[]))}>
          Send my answers
        </BigBtn>
      </div>
      <Err e={err} />
    </div>
  );
}

/* ============================ Question of the day ============================ */

export function DailyQuestion({ question, mine, theirs, theyAnswered, partner }: { question: string; mine: string | null; theirs: string | null; theyAnswered: boolean; partner: string }) {
  const { pending, err, run } = useAct();
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2">
        <Emote name="think" size={40} />
        <p className="font-display text-[19px] font-semibold leading-snug">“{question}”</p>
      </div>
      {mine ? (
        <>
          <div className="rounded-2xl bg-bubble px-3 py-2">
            <p className="text-[12px] font-bold text-ink-soft">You</p>
            <p className="whitespace-pre-wrap text-[15px] font-medium">{mine}</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-[var(--color-line)]">
            <p className="text-[12px] font-bold text-ink-soft">{partner}</p>
            <p className="whitespace-pre-wrap text-[15px] font-medium">{theirs ?? `Not answered yet. Give ${partner} a nudge!`}</p>
          </div>
        </>
      ) : (
        <>
          {theyAnswered && <p className="text-[13px] font-bold">{partner} answered! Answer to see theirs.</p>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={3} placeholder="Your answer" className="field py-2.5" />
          <div>
            <BigBtn pending={pending || !text.trim()} onClick={() => run(() => answerQuestion(text))}>
              Answer
            </BigBtn>
          </div>
        </>
      )}
      <Err e={err} />
    </div>
  );
}

/* ============================ Connect Four / Gomoku ============================ */

export function GridGame({
  kind,
  game,
  meId,
  partner,
}: Turn & {
  kind: GridKind;
  game: { id: string; board: (string | null)[]; a: string; status: string; turn: string | null; winner: string | null; last: number | null; line: number[] | null; secs: number; since: string } | null;
}) {
  const { pending, err, run } = useAct();
  const [secs, setSecs] = useState<number>(0);
  const cfg = GRID[kind];
  const mine = game ? (game.a === meId ? "a" : "b") : "a";
  const myTurn = game?.status === "active" && game.turn === meId;
  const myName = kind === "c4" ? (mine === "a" ? "red" : "yellow") : mine === "a" ? "black" : "white";
  const o = game ? outcome(game.status === "done", game.winner, meId, myTurn, partner, `Your turn, you're ${myName}`) : null;
  const piece = (m: string, i: number) => {
    const color = kind === "c4" ? (m === "a" ? "#FF6B6B" : "#FFD24D") : m === "a" ? "#2E2240" : "#FFFFFF";
    const row = Math.floor(i / cfg.cols);
    const isLast = game?.last === i;
    return (
      <span
        key={`${game?.id}-${i}`}
        className={`block size-[82%] rounded-full border-2 border-ink ${isLast ? (kind === "c4" ? "piece-drop" : "pop-place") : ""} ${game?.line?.includes(i) ? "win-pulse" : ""}`}
        style={{
          background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.65) 0 18%, transparent 19%), ${color}`,
          ...(isLast && kind === "c4" ? { ["--drop" as string]: `-${(row + 1) * 112}%` } : {}),
        }}
      />
    );
  };
  return (
    <div className="flex flex-col items-center gap-3">
      {o && <Banner {...o} />}
      {game && <TurnTimer id={game.id} secs={game.secs} since={game.since} active={game.status === "active"} />}
      {game && (
        <div
          className={`grid w-full max-w-[380px] gap-1 overflow-hidden rounded-[22px] border-2 border-ink p-2 shadow-[0_5px_0_#2E2240] ${kind === "c4" ? "bg-[#5B7BE0]" : "bg-[#E9C892]"}`}
          style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
          role="grid"
          aria-label={cfg.name}
        >
          {game.board.map((c, i) => {
            const col = i % cfg.cols;
            const can = myTurn && !pending && (cfg.gravity ? !game.board[col] : !c);
            return (
              <button
                key={i}
                type="button"
                disabled={!can}
                onClick={() => run(() => playGrid(game.id, cfg.gravity ? col : i))}
                aria-label={`${cfg.gravity ? `Column ${col + 1}` : `Spot ${i + 1}`}${c ? ", taken" : ""}`}
                className={`relative flex aspect-square items-center justify-center ${kind === "c4" ? "rounded-full border-2 border-ink/70 bg-[#EAF0FF]" : "rounded-[4px] bg-[#F6E2BE]"} ${can && !c ? "hover:brightness-95" : ""}`}
              >
                {c && piece(c, i)}
              </button>
            );
          })}
        </div>
      )}
      {kind === "c4" && game?.status === "active" && <p className="text-[12px] font-semibold text-ink-soft">Tap any column to drop your piece. Get 4 in a row!</p>}
      {kind === "gomoku" && game?.status === "active" && <p className="text-[12px] font-semibold text-ink-soft">Place one stone per turn. First to get 5 in a row wins.</p>}
      {(!game || game.status === "done") && (
        <>
          <Seg label="Turn timer" value={secs} options={TURN_SECS} onChange={setSecs} show={secsLabel} />
          <BigBtn pending={pending} onClick={() => run(() => newGrid(kind, secs))}>
            {game ? "Play again" : "New game"}
          </BigBtn>
        </>
      )}
      {game?.status === "active" && (
        <button type="button" disabled={pending} onClick={() => confirm("Start over?") && run(() => newGrid(kind, game.secs))} className="text-[12px] font-bold text-ink-soft underline">
          Restart
        </button>
      )}
      <Confetti run={game?.status === "done" && game.winner === meId} />
      <Err e={err} />
    </div>
  );
}

/* ============================ Snakes and ladders ============================ */

function Die({ n, rolling }: { n: number; rolling: boolean }) {
  const pips: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  return (
    <svg key={rolling ? "r" : `n${n}`} width={64} height={64} viewBox="0 0 100 100" className={rolling ? "dice-tumble" : "pop-place"} aria-label={`Dice shows ${n}`}>
      <rect x={6} y={10} width={88} height={84} rx={22} fill="#E4DCD2" />
      <rect x={6} y={6} width={88} height={84} rx={22} fill="#FFFFFF" stroke="#2E2240" strokeWidth={5} />
      {(pips[n] ?? pips[1]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y - 2} r={8.5} fill={n === 1 ? "#FF6B6B" : "#2E2240"} />
      ))}
    </svg>
  );
}

export function SnakesLadders({
  game,
  meId,
  partner,
}: Turn & {
  game: {
    id: string;
    pos: Record<string, number>;
    a: string;
    b: string;
    status: string;
    turn: string | null;
    winner: string | null;
    last: { by: string; roll: number; from: number; to: number; final: number } | null;
    secs: number;
    since: string;
  } | null;
}) {
  const { pending, err, run } = useAct();
  const [rolling, setRolling] = useState(false);
  const [secs, setSecs] = useState<number>(0);
  const myTurn = game?.status === "active" && game.turn === meId;
  const other = game ? (game.a === meId ? game.b : game.a) : "";
  const meAt = game?.pos[meId] ?? 0;
  const themAt = game?.pos[other] ?? 0;
  const last = game?.last;
  const lastText = last
    ? `${last.by === meId ? "You" : partner} rolled ${last.roll}${last.final !== last.to ? (last.final > last.to ? `, climbed a ladder to ${last.final}!` : `, slid down a snake to ${last.final}!`) : `, now on ${last.final}`}`
    : null;
  const o = game
    ? game.status === "done"
      ? { text: game.winner === meId ? "You reached 100 and won!" : `${partner} won this one. Rematch?`, mood: (game.winner === meId ? "party" : "angry") as EmoteName, hot: game.winner === meId }
      : myTurn
        ? { text: "Your turn, roll the dice!", mood: "wink" as EmoteName, hot: true }
        : { text: `Waiting for ${partner} to roll`, mood: "think" as EmoteName, hot: false }
    : null;
  const cells: number[] = [];
  for (let r = 9; r >= 0; r--) {
    const row = Array.from({ length: 10 }, (_, c) => r * 10 + c + 1);
    cells.push(...(r % 2 === 1 ? row.reverse() : row));
  }
  const token = (who: "me" | "them", hop: boolean) => (
    <span key={`${who}${who === "me" ? meAt : themAt}`} className={`block size-3 rounded-full border-2 border-ink ${who === "me" ? "bg-[#FF6B6B]" : "bg-[#5B7BE0]"} ${hop ? "token-hop" : ""}`} />
  );
  return (
    <div className="flex flex-col items-center gap-3">
      {o && <Banner {...o} />}
      {game && <TurnTimer id={game.id} secs={game.secs} since={game.since} active={game.status === "active"} />}
      {game && (
        <>
          <div className="grid w-full max-w-[380px] grid-cols-10 gap-[2px] overflow-hidden rounded-[18px] border-2 border-ink bg-ink/10 p-[3px] shadow-[0_5px_0_#2E2240]" aria-label="Snakes and ladders board">
            {cells.map((n) => {
              const j = JUMPS[n];
              const meHere = meAt === n;
              const themHere = themAt === n;
              return (
                <div
                  key={n}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-[5px] text-[9px] font-extrabold ${
                    n === 100 ? "bg-sun" : j ? (j > n ? "bg-mint" : "bg-pink") : (Math.floor((n - 1) / 10) + n) % 2 ? "bg-white" : "bg-peach-soft"
                  }`}
                >
                  <span className="absolute left-0.5 top-0 text-[8px] text-ink-soft">{n}</span>
                  {j && (
                    <svg viewBox="0 0 20 20" className="size-[60%]" aria-label={j > n ? `ladder to ${j}` : `snake to ${j}`}>
                      {j > n ? (
                        <path d="M6 18 V2 M14 18 V2 M6 5 h8 M6 10 h8 M6 15 h8" stroke="#2E2240" strokeWidth={2} strokeLinecap="round" />
                      ) : (
                        <path d="M14 3 c-8 1 -8 6 0 7 c8 1 6 7 -3 8" fill="none" stroke="#2EB67D" strokeWidth={3.4} strokeLinecap="round" />
                      )}
                    </svg>
                  )}
                  {(meHere || themHere) && (
                    <span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-[1px]">
                      {meHere && token("me", last?.by === meId)}
                      {themHere && token("them", last?.by === other)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-[13px] font-extrabold">
            <span className="flex items-center gap-1">
              <span className="size-3.5 rounded-full border-2 border-ink bg-[#FF6B6B]" /> You {meAt}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3.5 rounded-full border-2 border-ink bg-[#5B7BE0]" /> {partner} {themAt}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Die n={last?.roll ?? 6} rolling={rolling} />
            {game.status === "active" && (
              <BigBtn
                pending={!myTurn || pending}
                onClick={() => {
                  setRolling(true);
                  setTimeout(() => setRolling(false), 800);
                  run(() => rollLadder(game.id));
                }}
              >
                Roll the dice
              </BigBtn>
            )}
          </div>
          {lastText && <p className="text-center text-[13px] font-bold text-ink-soft">{lastText}</p>}
          <p className="text-center text-[12px] font-semibold text-ink-soft">Green squares are ladders (up), pink ones are snakes (down). Roll a 6 to go again. Land exactly on 100 to win.</p>
        </>
      )}
      {(!game || game.status === "done") && (
        <>
          <Seg label="Turn timer" value={secs} options={TURN_SECS} onChange={setSecs} show={secsLabel} />
          <BigBtn pending={pending} onClick={() => run(() => newLadder(secs))}>
            {game ? "Play again" : "New game"}
          </BigBtn>
        </>
      )}
      <Confetti run={game?.status === "done" && game.winner === meId} />
      <Err e={err} />
    </div>
  );
}

/* ============================ Word guess ============================ */

function WordClock({ id, deadline, active }: { id: string; deadline: number | null; active: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    if (!deadline || !active) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadline, active]);
  const left = deadline && now != null ? Math.max(0, deadline - now) : 1;
  useEffect(() => {
    if (now == null || !deadline || !active || left > 0 || fired.current) return;
    fired.current = true;
    wordTimeout(id).then(() => router.refresh());
  }, [now, left, deadline, active, id, router]);
  if (!deadline || !active || now == null) return null;
  const s = Math.ceil(left / 1000);
  return <span className={`rounded-full border-2 border-ink px-3 py-0.5 text-[14px] font-extrabold tabular-nums ${s <= 15 ? "bg-pink" : "bg-white"}`}>{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}</span>;
}

export function WordGuess({
  game,
  meId,
  partner,
}: Turn & {
  game: {
    id: string;
    mask: string;
    word: string | null;
    hint: string;
    guessed: string[];
    wrong: number;
    lives: number;
    deadline: number | null;
    setter: string;
    guesser: string;
    status: string;
    winner: string | null;
    solvedBy: string | null;
  } | null;
}) {
  const { pending, err, run } = useAct();
  const [mode, setMode] = useState<"me" | "chichi">("me");
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [len, setLen] = useState(5);
  const [lives, setLives] = useState<number>(7);
  const [time, setTime] = useState<number>(0);
  const setter = game?.setter === meId;
  const together = game?.setter === "chichi";
  const done = game?.status === "done";
  const canGuess = !!game && !done && (together || game.guesser === meId);
  const make = (
    <div className="flex w-full max-w-sm flex-col items-center gap-2.5">
      <Seg label="Who makes the word?" value={mode} options={["me", "chichi"] as const} onChange={setMode} show={(v) => (v === "me" ? "I make it" : "Chichi picks")} />
      {mode === "me" ? (
        <>
          <input value={word} onChange={(e) => setWord(e.target.value.toUpperCase().replace(/[^A-Z ]/g, ""))} maxLength={24} placeholder="SUSHI DATE" className="field text-center font-display text-lg tracking-widest" aria-label="Secret word" />
          <p className="text-[12px] font-bold text-ink-soft">{word.replace(/ /g, "").length} letters (2 to 24, any length you like)</p>
          <input value={hint} onChange={(e) => setHint(e.target.value)} maxLength={80} placeholder="Hint (optional): our favourite food" className="field" aria-label="Hint" />
        </>
      ) : (
        <Seg label="Word length" value={len} options={WORD_LENGTHS} onChange={setLen} show={(v) => String(v)} />
      )}
      <Seg label="Lives" value={lives} options={LIVES} onChange={setLives} show={(v) => (v ? String(v) : "Unlimited")} />
      <Seg label="Time limit" value={time} options={WORD_TIME} onChange={setTime} show={(v) => (v ? `${v / 60} min` : "Off")} />
      <BigBtn
        pending={pending}
        onClick={() =>
          run(async () => {
            const r = mode === "me" ? await newWordGuess(word, hint, lives, time) : await newChichiWord(len, lives, time);
            if (r.ok) {
              setWord("");
              setHint("");
            }
            return r;
          })
        }
      >
        {mode === "me" ? `Send the word to ${partner}` : "Let Chichi pick"}
      </BigBtn>
    </div>
  );
  if (!game) return <div className="flex flex-col items-center gap-3">{make}<Err e={err} /></div>;
  const reveal = done || setter;
  const shown = reveal ? (game.word ?? game.mask) : game.mask;
  const o: { text: string; mood: EmoteName; hot: boolean } = done
    ? game.solvedBy
      ? game.solvedBy === meId
        ? { text: together ? "You finished the word!" : "You guessed it!", mood: "party", hot: true }
        : { text: together ? `${partner} finished it! Teamwork!` : `${partner} guessed your word!`, mood: "love", hot: false }
      : { text: `Out of ${game.deadline && game.lives && game.wrong < game.lives ? "time" : "lives"}! It was ${game.word}`, mood: "cry", hot: false }
    : setter
      ? { text: `${partner} is guessing your word`, mood: "think", hot: false }
      : { text: together ? "Guess it together, any letter, any time" : "Guess the word, one letter at a time", mood: "wink", hot: true };
  return (
    <div className="flex flex-col items-center gap-3">
      <Banner {...o} />
      <WordClock id={game.id} deadline={game.deadline} active={!done} />
      {game.hint && (
        <p className="flex items-center gap-1.5 text-[13px] font-bold">
          <Emote name="think" size={22} /> {game.hint}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-1.5">
        {shown.split("").map((ch, i) =>
          ch === " " ? (
            <span key={i} className="w-4" />
          ) : (
            <span
              key={`${i}${ch}`}
              className={`font-display flex h-12 w-10 items-center justify-center rounded-xl border-2 border-ink text-[24px] font-semibold shadow-[0_3px_0_#2E2240] ${
                ch === "_" ? "bg-white" : game.mask[i] === "_" ? "bg-pink-soft text-coral" : "pop-place bg-sun"
              }`}
            >
              {ch === "_" ? "" : ch}
            </span>
          ),
        )}
      </div>
      <div className="flex items-center gap-1" aria-label={game.lives ? `${game.lives - game.wrong} lives left` : "Unlimited lives"}>
        {game.lives ? (
          Array.from({ length: game.lives }, (_, i) => (
            <svg key={i} width={20} height={20} viewBox="-10 -10 20 20" className={i < game.lives - game.wrong ? "" : "opacity-25 grayscale"}>
              <path d="M0 7 C-10 0 -5 -9 0 -3.5 C5 -9 10 0 0 7 Z" fill="#FF5C7A" stroke="#2E2240" strokeWidth={1.5} />
            </svg>
          ))
        ) : (
          <span className="text-[12px] font-extrabold text-ink-soft">Unlimited lives, {game.wrong} misses</span>
        )}
      </div>
      {canGuess && (
        <div className="grid w-full max-w-sm grid-cols-7 gap-1.5">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => {
            const used = game.guessed.includes(L);
            const hit = used && game.mask.includes(L);
            return (
              <button
                key={L}
                type="button"
                disabled={used || pending}
                onClick={() => run(() => guessLetter(game.id, L))}
                className={`press h-11 rounded-xl border-2 text-[16px] font-extrabold ${used ? (hit ? "border-leaf bg-mint" : "border-transparent bg-cream text-ink-soft line-through") : "border-ink bg-white shadow-[0_2px_0_#2E2240] hover:bg-sun-soft"}`}
              >
                {L}
              </button>
            );
          })}
        </div>
      )}
      {done && make}
      <Confetti run={!!done && game.solvedBy === meId} />
      <Err e={err} />
    </div>
  );
}

/* ============================ Memory match ============================ */

export function MemoryMatch({
  game,
  meId,
  partner,
}: Turn & {
  game: { id: string; cards: string[]; matched: Record<number, string>; open: number[]; a: string; b: string; score: Record<string, number>; status: string; turn: string | null; winner: string | null; secs: number; since: string } | null;
}) {
  const { pending, err, run } = useAct();
  const [size, setSize] = useState<keyof typeof MEMORY_SIZES>("medium");
  const [secs, setSecs] = useState<number>(0);
  const myTurn = game?.status === "active" && game.turn === meId;
  const other = game ? (game.a === meId ? game.b : game.a) : "";
  const o = game ? outcome(game.status === "done", game.winner, meId, myTurn, partner, "Your turn, flip two cards") : null;
  const cols = game ? (game.cards.length === 12 ? 4 : game.cards.length === 16 ? 4 : 5) : 4;
  return (
    <div className="flex flex-col items-center gap-3">
      {o && <Banner {...o} />}
      {game && <TurnTimer id={game.id} secs={game.secs} since={game.since} active={game.status === "active"} />}
      {game && (
        <>
          <div className="flex items-center gap-4 text-[14px] font-extrabold">
            <span className="rounded-full border-2 border-ink bg-pink-soft px-3 py-0.5">You {game.score[meId] ?? 0}</span>
            <span className="rounded-full border-2 border-ink bg-sky-soft px-3 py-0.5">
              {partner} {game.score[other] ?? 0}
            </span>
          </div>
          <div className="grid w-full max-w-[380px] gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {game.cards.map((face, i) => {
              const up = game.open.includes(i) || !!game.matched[i];
              const can = myTurn && !pending && !up;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!can}
                  onClick={() => run(() => flipCard(game.id, i))}
                  aria-label={up ? `Card ${i + 1}: ${face}` : `Card ${i + 1}, face down`}
                  className={`card3d aspect-[3/4] ${up ? "flipped" : ""}`}
                >
                  <span className="card3d-inner block">
                    <span className="card-face flex items-center justify-center rounded-2xl border-2 border-ink bg-linear-to-br from-lilac to-pink shadow-[0_3px_0_#2E2240]">
                      <svg viewBox="0 0 40 40" className="size-1/2 opacity-80">
                        <path d="M20 31 C6 22 10 9 20 15 C30 9 34 22 20 31 Z" fill="white" stroke="#2E2240" strokeWidth={2} />
                      </svg>
                    </span>
                    <span
                      className={`card-face card-front flex items-center justify-center rounded-2xl border-2 border-ink shadow-[0_3px_0_#2E2240] ${
                        game.matched[i] ? (game.matched[i] === meId ? "bg-pink-soft" : "bg-sky-soft") : "bg-white"
                      }`}
                    >
                      <Emote name={face as EmoteName} size={44} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-[12px] font-semibold text-ink-soft">Find a pair and you go again. Pink cards are yours, blue are {partner}&apos;s.</p>
        </>
      )}
      {(!game || game.status === "done") && (
        <>
          <Seg label="Cards" value={size} options={["small", "medium", "big"] as const} onChange={setSize} show={(v) => `${MEMORY_SIZES[v]}`} />
          <Seg label="Turn timer" value={secs} options={TURN_SECS} onChange={setSecs} show={secsLabel} />
          <BigBtn pending={pending} onClick={() => run(() => newMemory(size, secs))}>
            {game ? "Play again" : "New game"}
          </BigBtn>
        </>
      )}
      <Confetti run={game?.status === "done" && game.winner === meId} />
      <Err e={err} />
    </div>
  );
}

/* ============================ Dots and boxes ============================ */

export function DotsBoxes({
  game,
  meId,
  partner,
}: Turn & {
  game: { id: string; lines: Record<string, string>; boxes: Record<string, string>; a: string; b: string; last: string | null; status: string; turn: string | null; winner: string | null; secs: number; since: string } | null;
}) {
  const { pending, err, run } = useAct();
  const [secs, setSecs] = useState<number>(0);
  const myTurn = game?.status === "active" && game.turn === meId;
  const other = game ? (game.a === meId ? game.b : game.a) : "";
  const o = game ? outcome(game.status === "done", game.winner, meId, myTurn, partner, "Your turn, draw a line") : null;
  const S = 64; // gap between dots
  const P = 16;
  const W = BOX_N * S + P * 2;
  const mineN = game ? Object.values(game.boxes).filter((v) => v === meId).length : 0;
  const theirN = game ? Object.values(game.boxes).filter((v) => v === other).length : 0;
  const color = (uid: string) => (uid === meId ? "#FF6B6B" : "#5B7BE0");
  const lineEl = (k: string, x1: number, y1: number, x2: number, y2: number) => {
    const by = game?.lines[k];
    const can = myTurn && !pending && !by;
    return (
      <g key={k}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={by ? color(by) : "#EADFD6"} strokeWidth={by ? 8 : 6} strokeLinecap="round" className={game?.last === k ? "pop-place" : ""} style={{ transformOrigin: `${(x1 + x2) / 2}px ${(y1 + y2) / 2}px` }} />
        {by && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2E2240" strokeOpacity={0.25} strokeWidth={2} strokeLinecap="round" />}
        <rect
          x={Math.min(x1, x2) - (x1 === x2 ? 13 : -6)}
          y={Math.min(y1, y2) - (y1 === y2 ? 13 : -6)}
          width={x1 === x2 ? 26 : Math.abs(x2 - x1) - 12}
          height={y1 === y2 ? 26 : Math.abs(y2 - y1) - 12}
          rx={10}
          fill="transparent"
          className={can ? "cursor-pointer" : ""}
          onClick={() => can && game && run(() => drawLine(game.id, k))}
          role="button"
          aria-label={`Line ${k}${by ? ", drawn" : ""}`}
        />
      </g>
    );
  };
  return (
    <div className="flex flex-col items-center gap-3">
      {o && <Banner {...o} />}
      {game && <TurnTimer id={game.id} secs={game.secs} since={game.since} active={game.status === "active"} />}
      {game && (
        <>
          <div className="flex items-center gap-4 text-[14px] font-extrabold">
            <span className="rounded-full border-2 border-ink bg-pink-soft px-3 py-0.5">You {mineN}</span>
            <span className="rounded-full border-2 border-ink bg-sky-soft px-3 py-0.5">
              {partner} {theirN}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${W}`} className="w-full max-w-[340px] rounded-[22px] border-2 border-ink bg-white shadow-[0_5px_0_#2E2240]">
            {Object.entries(game.boxes).map(([k, uid]) => {
              const [r, c] = k.split(",").map(Number);
              return (
                <g key={k} className="pop-place" style={{ transformOrigin: `${P + c * S + S / 2}px ${P + r * S + S / 2}px` }}>
                  <rect x={P + c * S + 6} y={P + r * S + 6} width={S - 12} height={S - 12} rx={10} fill={uid === meId ? "#FFE3EE" : "#E5F0FF"} />
                  <foreignObject x={P + c * S + 14} y={P + r * S + 14} width={S - 28} height={S - 28}>
                    <Emote name={uid === meId ? "love" : "cool"} size={S - 28} />
                  </foreignObject>
                </g>
              );
            })}
            {Array.from({ length: BOX_N + 1 }, (_, r) => Array.from({ length: BOX_N }, (_, c) => lineEl(`h${r}_${c}`, P + c * S, P + r * S, P + (c + 1) * S, P + r * S)))}
            {Array.from({ length: BOX_N }, (_, r) => Array.from({ length: BOX_N + 1 }, (_, c) => lineEl(`v${r}_${c}`, P + c * S, P + r * S, P + c * S, P + (r + 1) * S)))}
            {Array.from({ length: BOX_N + 1 }, (_, r) =>
              Array.from({ length: BOX_N + 1 }, (_, c) => <circle key={`d${r}${c}`} cx={P + c * S} cy={P + r * S} r={7} fill="#2E2240" />),
            )}
          </svg>
          <p className="text-center text-[12px] font-semibold text-ink-soft">Close a box to claim it and draw again. Most boxes wins.</p>
        </>
      )}
      {(!game || game.status === "done") && (
        <>
          <Seg label="Turn timer" value={secs} options={TURN_SECS} onChange={setSecs} show={secsLabel} />
          <BigBtn pending={pending} onClick={() => run(() => newBoxes(secs))}>
            {game ? "Play again" : "New game"}
          </BigBtn>
        </>
      )}
      <Confetti run={game?.status === "done" && game.winner === meId} />
      <Err e={err} />
    </div>
  );
}
