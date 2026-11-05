import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { DailyQuestion, DotsBoxes, GridGame, MemoryMatch, RockPaperScissors, SnakesLadders, ThisOrThat, TicTacToe, WordGuess } from "@/components/games";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { Emote } from "@/components/emote";
import { PageTitle, Panel } from "@/components/ui";
import { db, schema } from "@/db";
import { QUESTIONS, maskWord, questionFor, type RpsPick } from "@/lib/games-content";
import { todayISO } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Play together" };

const GAMES: { k: string; t: string; icon: CuteIconName; d: string; tone: string }[] = [
  { k: "c4", t: "Connect Four", icon: "c4", d: "Drop pieces, 4 in a row wins", tone: "from-sky-soft to-white" },
  { k: "ladder", t: "Snakes and Ladders", icon: "ladder", d: "Ular tangga, roll the dice", tone: "from-mint-soft to-white" },
  { k: "word", t: "Word Guess", icon: "word", d: "Tebak kata, any length, your rules", tone: "from-sun-soft to-white" },
  { k: "memory", t: "Memory Match", icon: "memory", d: "Flip cards, find the pairs", tone: "from-lilac-soft to-white" },
  { k: "boxes", t: "Dots and Boxes", icon: "boxes", d: "Close a box to score", tone: "from-pink-soft to-white" },
  { k: "gomoku", t: "Gomoku", icon: "gomoku", d: "5 in a row on a big board", tone: "from-peach-soft to-white" },
  { k: "ttt", t: "Tic Tac Toe", icon: "ttt", d: "The quick classic", tone: "from-lilac-soft to-white" },
  { k: "rps", t: "Rock Paper Scissors", icon: "rps", d: "Picks stay hidden", tone: "from-peach-soft to-white" },
  { k: "tot", t: "This or That", icon: "tot", d: "How much do you match?", tone: "from-pink-soft to-white" },
];

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const me = await getMe();
  const gq = (await searchParams).g;
  const sel = GAMES.find((x) => x.k === gq) ?? null;
  const G = schema.game;
  const users = await db.select({ id: schema.user.id, name: schema.user.name, role: schema.user.role }).from(schema.user);
  const partnerU = users.find((u) => u.id !== me.id && (me.role === "owner" ? u.role === "viewer" : u.id === me.spaceId));
  const partner = partnerU?.name ?? "them";
  const pid = partnerU?.id ?? "";
  const today = todayISO();

  const kinds = ["ttt", "rps", "tot", "c4", "gomoku", "ladder", "word", "memory", "boxes"];
  const [recent, q, history, finished] = await Promise.all([
    db.select().from(G).where(and(eq(G.ownerId, me.spaceId), inArray(G.kind, kinds))).orderBy(desc(G.createdAt)).limit(120),
    db.select().from(G).where(and(eq(G.ownerId, me.spaceId), eq(G.kind, "question"), eq(G.day, today))).limit(1),
    db.select().from(G).where(and(eq(G.ownerId, me.spaceId), eq(G.kind, "question"), eq(G.status, "done"))).orderBy(desc(G.day)).limit(8),
    db.select({ w: G.winnerUserId }).from(G).where(and(eq(G.ownerId, me.spaceId), inArray(G.kind, kinds), eq(G.status, "done"))),
  ]);
  const latest = (k: string) => recent.find((r) => r.kind === k) ?? null;
  const myWins = finished.filter((f) => f.w === me.id).length;
  const theirWins = finished.filter((f) => f.w && f.w === pid).length;

  const tile = (k: string): { hot: boolean; text: string } => {
    const row = latest(k);
    if (!row || row.status === "done") return { hot: false, text: "New game" };
    if (k === "rps" || k === "tot") {
      const st = row.state as { picks: Record<string, unknown> };
      return st.picks[me.id] ? { hot: false, text: `Waiting for ${partner}` } : { hot: true, text: st.picks[pid] ? `${partner} is waiting!` : "Your pick" };
    }
    if (k === "word") {
      const st = row.state as { setter: string; guesser: string };
      return st.guesser === "both" || st.guesser === me.id ? { hot: true, text: "Guess now!" } : { hot: false, text: `${partner} is guessing` };
    }
    return row.turnUserId === me.id ? { hot: true, text: "Your turn!" } : { hot: false, text: `${partner}'s turn` };
  };
  const base = (row: NonNullable<ReturnType<typeof latest>>) => ({
    id: row.id,
    status: row.status,
    turn: row.turnUserId,
    winner: row.winnerUserId,
    since: row.updatedAt.toISOString(),
    secs: Number((row.state as { secs?: number }).secs) || 0,
  });

  const qRow = q[0];
  const qS = qRow?.state as { q: number; answers: Record<string, string> } | undefined;
  const qMine = qS?.answers[me.id] ?? null;

  const view = (() => {
    if (!sel) return null;
    const row = latest(sel.k);
    switch (sel.k) {
      case "ttt": {
        const st = row?.state as { board: (string | null)[]; x: string; last?: number | null } | undefined;
        return <TicTacToe meId={me.id} partner={partner} game={row && st ? { ...base(row), board: st.board, x: st.x, last: st.last ?? null } : null} />;
      }
      case "c4":
      case "gomoku": {
        const st = row?.state as { board: (string | null)[]; a: string; last: number | null; line: number[] | null } | undefined;
        return <GridGame kind={sel.k} meId={me.id} partner={partner} game={row && st ? { ...base(row), board: st.board, a: st.a, last: st.last ?? null, line: st.line ?? null } : null} />;
      }
      case "ladder": {
        const st = row?.state as { pos: Record<string, number>; a: string; b: string; last: { by: string; roll: number; from: number; to: number; final: number } | null } | undefined;
        return <SnakesLadders meId={me.id} partner={partner} game={row && st ? { ...base(row), pos: st.pos, a: st.a, b: st.b, last: st.last } : null} />;
      }
      case "word": {
        const st = row?.state as { word: string; hint: string; guessed: string[]; wrong: number; lives?: number; deadline?: number | null; setter: string; guesser: string; solvedBy?: string | null } | undefined;
        return (
          <WordGuess
            key={row?.id ?? "none"}
            meId={me.id}
            partner={partner}
            game={
              row && st
                ? {
                    id: row.id,
                    mask: maskWord(st.word, st.guessed),
                    // guessers never receive the word until the round is over
                    word: st.setter === me.id || row.status === "done" ? st.word : null,
                    hint: st.hint,
                    guessed: st.guessed,
                    wrong: st.wrong,
                    lives: st.lives ?? 7,
                    deadline: st.deadline ?? null,
                    setter: st.setter,
                    guesser: st.guesser,
                    status: row.status,
                    winner: row.winnerUserId,
                    solvedBy: st.solvedBy ?? (row.status === "done" && row.winnerUserId && row.winnerUserId !== st.setter ? row.winnerUserId : null),
                  }
                : null
            }
          />
        );
      }
      case "memory": {
        const st = row?.state as { cards: string[]; matched: Record<number, string>; open: number[]; a: string; b: string; score: Record<string, number> } | undefined;
        return <MemoryMatch meId={me.id} partner={partner} game={row && st ? { ...base(row), cards: st.cards, matched: st.matched, open: st.open, a: st.a, b: st.b, score: st.score } : null} />;
      }
      case "boxes": {
        const st = row?.state as { lines: Record<string, string>; boxes: Record<string, string>; a: string; b: string; last: string | null } | undefined;
        return <DotsBoxes meId={me.id} partner={partner} game={row && st ? { ...base(row), lines: st.lines, boxes: st.boxes, a: st.a, b: st.b, last: st.last } : null} />;
      }
      case "rps": {
        const st = row?.state as { picks: Record<string, RpsPick> } | undefined;
        const done = row?.status === "done";
        return (
          <RockPaperScissors
            meId={me.id}
            partner={partner}
            done={done}
            winner={row?.winnerUserId ?? null}
            mine={(row && st?.picks[me.id]) || null}
            theirs={row && st?.picks[pid] ? (done ? st.picks[pid] : "hidden") : null}
          />
        );
      }
      case "tot": {
        const st = row?.state as { pairs: number[]; picks: Record<string, number[]> } | undefined;
        return (
          <ThisOrThat
            key={row?.id ?? "none"}
            partner={partner}
            game={
              row && st
                ? { id: row.id, pairs: st.pairs, mine: st.picks[me.id] ?? null, theirs: row.status === "done" ? (st.picks[pid] ?? null) : null, theyAnswered: !!st.picks[pid], done: row.status === "done" }
                : null
            }
          />
        );
      }
    }
    return null;
  })();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Play together" icon="game" help={false} subtitle={`Little games for you and ${partner}`} />

      <section className="sticker flex items-center justify-around rounded-[28px] bg-linear-to-r from-pink-soft via-white to-sky-soft p-3 text-center">
        <div className="flex flex-col items-center">
          <Emote name={myWins >= theirWins ? "proud" : "angry"} size={44} />
          <p className="font-display text-3xl font-semibold leading-none">{myWins}</p>
          <p className="text-[12px] font-bold text-ink-soft">You</p>
        </div>
        <div className="flex flex-col items-center">
          <CuteIcon name="trophy" size={38} />
          <p className="text-[12px] font-bold text-ink-soft">wins</p>
        </div>
        <div className="flex flex-col items-center">
          <Emote name={theirWins > myWins ? "proud" : "cool"} size={44} />
          <p className="font-display text-3xl font-semibold leading-none">{theirWins}</p>
          <p className="text-[12px] font-bold text-ink-soft">{partner}</p>
        </div>
      </section>

      {!sel && (
        <>
          <Panel title="Question of the day" icon="qmark">
            <DailyQuestion
              question={QUESTIONS[qS?.q ?? questionFor(today)]}
              mine={qMine}
              theirs={qMine ? (qS?.answers[pid] ?? null) : null}
              theyAnswered={!!qS?.answers[pid]}
              partner={partner}
            />
          </Panel>
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((x) => {
              const t = tile(x.k);
              return (
                <Link
                  key={x.k}
                  href={`/play?g=${x.k}`}
                  className={`press relative flex flex-col gap-1 overflow-hidden rounded-[26px] border-2 border-ink bg-linear-to-b p-3.5 shadow-[0_4px_0_#2E2240] active:translate-y-[3px] active:shadow-[0_1px_0_#2E2240] ${x.tone}`}
                >
                  <CuteIcon name={x.icon} size={48} />
                  <span className="font-display text-[16px] font-semibold leading-tight">{x.t}</span>
                  <span className="text-[12px] font-semibold text-ink-soft">{x.d}</span>
                  <span className={`mt-1 self-start rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold ${t.hot ? "animate-pulse bg-[#FF8A5C] text-white" : "bg-white text-ink-soft"}`}>{t.text}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {sel && (
        <section className="sticker flex flex-col gap-3 rounded-[28px] bg-white p-4">
          <div className="flex items-center gap-2">
            <Link href="/play" className="press rounded-full border-2 border-ink bg-cream px-3 py-1 text-[13px] font-extrabold">
              All games
            </Link>
            <span className="flex-1" />
            <CuteIcon name={sel.icon} size={32} />
            <h2 className="font-display text-lg font-semibold">{sel.t}</h2>
          </div>
          {view}
        </section>
      )}

      {!sel && history.length > 0 && (
        <Panel title="Our answers" icon="book">
          <ul className="flex flex-col gap-3">
            {history.map((h) => {
              const s = h.state as { q: number; answers: Record<string, string> };
              return (
                <li key={h.id} className="flex flex-col gap-1 border-b border-[var(--color-line)] pb-3 last:border-0">
                  <span className="text-[12px] font-bold text-ink-soft">{h.day}</span>
                  <span className="text-[14px] font-bold">{QUESTIONS[s.q]}</span>
                  <span className="text-[13px] font-medium">
                    <b>You:</b> {s.answers[me.id]}
                  </span>
                  <span className="text-[13px] font-medium">
                    <b>{partner}:</b> {s.answers[pid]}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
