"use server";

/**
 * Games for two. Both of them can play (Rafi too). Every move pings the other phone.
 */
import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMe, type Me } from "@/lib/session";
import { todayISO } from "@/lib/format";
import { notify } from "@/server/notify";
import { allow } from "@/lib/rate";
import {
  BOX_N,
  GRID,
  JUMPS,
  LIVES,
  MEMORY_FACES,
  MEMORY_SIZES,
  QUESTIONS,
  RPS,
  TTT_LINES,
  TURN_SECS,
  WORD_TIME,
  boxLines,
  boxesTouching,
  lineAt,
  lineValid,
  maskWord,
  pickWord,
  questionFor,
  randomPairs,
  type GridKind,
  type RpsPick,
} from "@/lib/games-content";
import { randomInt } from "node:crypto";

const G = schema.game;
const refresh = () => revalidatePath("/play");

async function partnerOf(me: Me) {
  if (me.role !== "owner") return me.spaceId;
  const [v] = await db.select({ id: schema.user.id }).from(schema.user).where(and(eq(schema.user.role, "viewer"), ne(schema.user.id, me.id))).limit(1);
  return v?.id ?? null;
}

async function ping(me: Me, title: string, body = "Open Danchi to play 🎮") {
  if (!allow(`gameping:${me.id}`, 20, 60_000)) return;
  await notify(db, { ownerId: me.spaceId, kind: "love", audience: me.role === "owner" ? "viewer" : "owner", inbox: false, title, body, url: "/play" }).catch(() => {});
}

async function active(me: Me, kind: string) {
  const [g] = await db
    .select()
    .from(G)
    .where(and(eq(G.ownerId, me.spaceId), eq(G.kind, kind), eq(G.status, "active")))
    .orderBy(desc(G.createdAt))
    .limit(1);
  return g ?? null;
}

const secsOk = (n: unknown) => ((TURN_SECS as readonly number[]).includes(Number(n)) ? Number(n) : 0);

async function mine(me: Me, id: string) {
  const [g] = await db.select().from(G).where(and(eq(G.id, id), eq(G.ownerId, me.spaceId))).limit(1);
  return g ?? null;
}

/* ---------------- Tic tac toe ---------------- */

export async function newTicTacToe(secs: number = 0) {
  const me = await getMe();
  const other = await partnerOf(me);
  if (!other) return { ok: false, error: "No one to play with yet" };
  const running = await active(me, "ttt");
  if (running) await db.update(G).set({ status: "done", updatedAt: new Date() }).where(eq(G.id, running.id));
  await db.insert(G).values({
    ownerId: me.spaceId,
    kind: "ttt",
    createdBy: me.id,
    turnUserId: me.id,
    state: { board: Array(9).fill(null), x: me.id, o: other, secs: secsOk(secs), last: null },
  });
  await ping(me, `❌⭕ ${me.name} started tic tac toe`, "Your move after theirs!");
  refresh();
  return { ok: true };
}

export async function playTicTacToe(id: string, cell: number) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.kind !== "ttt" || g.status !== "active") return { ok: false, error: "This game is over" };
  if (g.turnUserId !== me.id) return { ok: false, error: "Not your turn yet" };
  const st = g.state as { board: (string | null)[]; x: string; o: string };
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || st.board[cell]) return { ok: false, error: "Pick an empty square" };
  const mark = st.x === me.id ? "x" : "o";
  const board = [...st.board];
  board[cell] = mark;
  const won = TTT_LINES.some((l) => l.every((i) => board[i] === mark));
  const full = board.every(Boolean);
  const other = mark === "x" ? st.o : st.x;
  await db
    .update(G)
    .set({
      state: { ...st, board, last: cell },
      status: won || full ? "done" : "active",
      winnerUserId: won ? me.id : null,
      turnUserId: won || full ? null : other,
      updatedAt: new Date(),
    })
    .where(eq(G.id, id));
  await ping(me, won ? `🏆 ${me.name} won tic tac toe!` : full ? "🤝 Tic tac toe: it's a draw!" : `❌⭕ Your turn! ${me.name} moved`);
  refresh();
  return { ok: true };
}

/* ---------------- Rock paper scissors ---------------- */

export async function pickRps(pick: RpsPick) {
  const me = await getMe();
  if (!(pick in RPS)) return { ok: false };
  const other = await partnerOf(me);
  let g = await active(me, "rps");
  if (!g) {
    [g] = await db.insert(G).values({ ownerId: me.spaceId, kind: "rps", createdBy: me.id, state: { picks: {} } }).returning();
  }
  const st = g.state as { picks: Record<string, RpsPick> };
  if (st.picks[me.id]) return { ok: false, error: "Already picked! Waiting for them" };
  const picks = { ...st.picks, [me.id]: pick };
  let status = "active";
  let winner: string | null = null;
  if (other && picks[other]) {
    status = "done";
    const a = picks[me.id];
    const b = picks[other];
    const beats: Record<RpsPick, RpsPick> = { rock: "scissors", paper: "rock", scissors: "paper" };
    winner = a === b ? null : beats[a] === b ? me.id : other;
  }
  await db.update(G).set({ state: { picks }, status, winnerUserId: winner, updatedAt: new Date() }).where(eq(G.id, g.id));
  await ping(
    me,
    status === "done" ? (winner === me.id ? `✊✋✌️ ${me.name} won the round!` : winner ? "✊✋✌️ You won the round! 🎉" : "✊✋✌️ Same pick, it's a draw!") : `✊✋✌️ ${me.name} picked. Your turn!`,
  );
  refresh();
  return { ok: true };
}

/* ---------------- This or that ---------------- */

export async function newThisOrThat() {
  const me = await getMe();
  const running = await active(me, "tot");
  if (running) await db.update(G).set({ status: "done", updatedAt: new Date() }).where(eq(G.id, running.id));
  await db.insert(G).values({ ownerId: me.spaceId, kind: "tot", createdBy: me.id, state: { pairs: randomPairs(6), picks: {} } });
  await ping(me, `🤔 ${me.name} started This or That`, "Pick yours and see how much you match 💞");
  refresh();
  return { ok: true };
}

export async function answerThisOrThat(id: string, answers: number[]) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.kind !== "tot" || g.status !== "active") return { ok: false, error: "This round is over" };
  const st = g.state as { pairs: number[]; picks: Record<string, number[]> };
  if (!Array.isArray(answers) || answers.length !== st.pairs.length || answers.some((a) => a !== 0 && a !== 1)) return { ok: false, error: "Answer them all first" };
  const picks = { ...st.picks, [me.id]: answers };
  const done = Object.keys(picks).length >= 2;
  await db.update(G).set({ state: { ...st, picks }, status: done ? "done" : "active", updatedAt: new Date() }).where(eq(G.id, id));
  await ping(me, done ? "💞 This or That results are in!" : `🤔 ${me.name} answered This or That. Your turn!`);
  refresh();
  return { ok: true };
}

/* ---------------- Question of the day ---------------- */

export async function answerQuestion(text: string) {
  const me = await getMe();
  const t = String(text ?? "").trim().slice(0, 600);
  if (!t) return { ok: false, error: "Write your answer first" };
  const day = todayISO();
  let [g] = await db
    .select()
    .from(G)
    .where(and(eq(G.ownerId, me.spaceId), eq(G.kind, "question"), eq(G.day, day)))
    .limit(1);
  if (!g) {
    [g] = await db.insert(G).values({ ownerId: me.spaceId, kind: "question", createdBy: me.id, day, state: { q: questionFor(day), answers: {} } }).returning();
  }
  const st = g.state as { q: number; answers: Record<string, string> };
  const answers = { ...st.answers, [me.id]: t };
  const done = Object.keys(answers).length >= 2;
  await db.update(G).set({ state: { ...st, answers }, status: done ? "done" : "active", updatedAt: new Date() }).where(eq(G.id, g.id));
  await ping(me, done ? "💬 You both answered today's question!" : `💬 ${me.name} answered today's question`, done ? "Open Danchi to read each other's answers" : `"${QUESTIONS[st.q]}" Answer to see theirs 👀`);
  refresh();
  return { ok: true };
}


/* ---------------- Connect Four and Gomoku ---------------- */

export async function newGrid(kind: GridKind, secs: number = 0) {
  if (!(kind in GRID)) return { ok: false };
  const me = await getMe();
  const other = await partnerOf(me);
  if (!other) return { ok: false, error: "No one to play with yet" };
  const g = GRID[kind];
  const running = await active(me, kind);
  if (running) await db.update(G).set({ status: "done", updatedAt: new Date() }).where(eq(G.id, running.id));
  await db.insert(G).values({
    ownerId: me.spaceId,
    kind,
    createdBy: me.id,
    turnUserId: me.id,
    state: { board: Array(g.cols * g.rows).fill(null), a: me.id, b: other, last: null, line: null, secs: secsOk(secs) },
  });
  await ping(me, `${kind === "c4" ? "🔴🟡" : "⚫⚪"} ${me.name} started ${g.name}`, "Your move after theirs!");
  refresh();
  return { ok: true };
}

export async function playGrid(id: string, pos: number) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || !(g.kind in GRID) || g.status !== "active") return { ok: false, error: "This game is over" };
  if (g.turnUserId !== me.id) return { ok: false, error: "Not your turn yet" };
  const cfg = GRID[g.kind as GridKind];
  const st = g.state as { board: (string | null)[]; a: string; b: string };
  const board = [...st.board];
  let at = -1;
  if (cfg.gravity) {
    if (!Number.isInteger(pos) || pos < 0 || pos >= cfg.cols) return { ok: false, error: "Pick a column" };
    for (let r = cfg.rows - 1; r >= 0; r--) {
      if (!board[r * cfg.cols + pos]) {
        at = r * cfg.cols + pos;
        break;
      }
    }
    if (at < 0) return { ok: false, error: "That column is full" };
  } else {
    if (!Number.isInteger(pos) || pos < 0 || pos >= board.length || board[pos]) return { ok: false, error: "Pick an empty spot" };
    at = pos;
  }
  const mark = st.a === me.id ? "a" : "b";
  board[at] = mark;
  const line = lineAt(board, cfg.cols, cfg.rows, at, cfg.win);
  const full = board.every(Boolean);
  const other = mark === "a" ? st.b : st.a;
  await db
    .update(G)
    .set({
      state: { ...st, board, last: at, line },
      status: line || full ? "done" : "active",
      winnerUserId: line ? me.id : null,
      turnUserId: line || full ? null : other,
      updatedAt: new Date(),
    })
    .where(eq(G.id, id));
  await ping(me, line ? `🏆 ${me.name} won ${cfg.name}!` : full ? `🤝 ${cfg.name}: it's a draw!` : `🎯 Your turn! ${me.name} moved in ${cfg.name}`);
  refresh();
  return { ok: true };
}

/* ---------------- Snakes and ladders ---------------- */

export async function newLadder(secs: number = 0) {
  const me = await getMe();
  const other = await partnerOf(me);
  if (!other) return { ok: false, error: "No one to play with yet" };
  const running = await active(me, "ladder");
  if (running) await db.update(G).set({ status: "done", updatedAt: new Date() }).where(eq(G.id, running.id));
  await db.insert(G).values({ ownerId: me.spaceId, kind: "ladder", createdBy: me.id, turnUserId: me.id, state: { pos: { [me.id]: 0, [other]: 0 }, a: me.id, b: other, last: null, secs: secsOk(secs) } });
  await ping(me, `🐍🪜 ${me.name} started Snakes and Ladders`, "Roll the dice when it's your turn!");
  refresh();
  return { ok: true };
}

export async function rollLadder(id: string) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.kind !== "ladder" || g.status !== "active") return { ok: false, error: "This game is over" };
  if (g.turnUserId !== me.id) return { ok: false, error: "Not your turn yet" };
  const st = g.state as { pos: Record<string, number>; a: string; b: string };
  const roll = randomInt(1, 7);
  const from = st.pos[me.id] ?? 0;
  let to = from + roll;
  if (to > 100) to = 100 - (to - 100); // bounce back from the top
  const via = JUMPS[to] ?? null;
  const final = via ?? to;
  const won = final === 100;
  const other = me.id === st.a ? st.b : st.a;
  const again = roll === 6 && !won; // a six rolls again
  await db
    .update(G)
    .set({
      state: { ...st, pos: { ...st.pos, [me.id]: final }, last: { by: me.id, roll, from, to, final } },
      status: won ? "done" : "active",
      winnerUserId: won ? me.id : null,
      turnUserId: won ? null : again ? me.id : other,
      updatedAt: new Date(),
    })
    .where(eq(G.id, id));
  if (!again) await ping(me, won ? `🏆 ${me.name} reached 100 and won!` : `🎲 ${me.name} rolled a ${roll}${via ? (via > to ? " and climbed a ladder 🪜" : " and hit a snake 🐍") : ""}. Your turn!`);
  refresh();
  return { ok: true, roll };
}

/* ---------------- Word guess ---------------- */

type WordState = { word: string; hint: string; guessed: string[]; wrong: number; lives: number; deadline: number | null; setter: string; guesser: string; solvedBy?: string | null };
const livesOk = (n: unknown) => ((LIVES as readonly number[]).includes(Number(n)) ? Number(n) : 7);
const timeOk = (n: unknown) => ((WORD_TIME as readonly number[]).includes(Number(n)) ? Number(n) : 0);

async function startWord(me: Me, st: WordState, title: string, body: string) {
  const running = await active(me, "word");
  if (running) await db.update(G).set({ status: "done", updatedAt: new Date() }).where(eq(G.id, running.id));
  await db.insert(G).values({ ownerId: me.spaceId, kind: "word", createdBy: me.id, turnUserId: st.guesser === "both" ? null : st.guesser, state: st });
  await ping(me, title, body);
  refresh();
  return { ok: true };
}

/** I make the word, they guess. */
export async function newWordGuess(word: string, hint: string, lives: number = 7, time: number = 0) {
  const me = await getMe();
  const other = await partnerOf(me);
  if (!other) return { ok: false, error: "No one to play with yet" };
  const w = String(word ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!/^[A-Z ]{2,24}$/.test(w) || w.replace(/ /g, "").length < 2) return { ok: false, error: "Use 2 to 24 letters (A to Z)" };
  const t = timeOk(time);
  const h = String(hint ?? "").trim().slice(0, 80);
  return startWord(
    me,
    { word: w, hint: h, guessed: [], wrong: 0, lives: livesOk(lives), deadline: t ? Date.now() + t * 1000 : null, setter: me.id, guesser: other },
    `🔤 ${me.name} made you a word to guess`,
    h ? `Hint: ${h}` : `${w.replace(/ /g, "").length} letters. Can you guess it?`,
  );
}

/** Chichi picks a word with the length we choose, and we guess it together. */
export async function newChichiWord(len: number, lives: number = 7, time: number = 0) {
  const me = await getMe();
  const L = Math.max(3, Math.min(12, Math.round(Number(len) || 5)));
  const w = pickWord(L, (n) => randomInt(0, n));
  const t = timeOk(time);
  return startWord(
    me,
    { word: w, hint: `Chichi picked a ${w.length} letter word`, guessed: [], wrong: 0, lives: livesOk(lives), deadline: t ? Date.now() + t * 1000 : null, setter: "chichi", guesser: "both" },
    `🔤 Chichi made a word for you two`,
    `${w.length} letters. Guess it together!`,
  );
}

export async function guessLetter(id: string, letter: string) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.kind !== "word" || g.status !== "active") return { ok: false, error: "This round is over" };
  const st = g.state as WordState;
  if (st.guesser !== "both" && st.guesser !== me.id) return { ok: false, error: "You made this word! Wait for their guesses" };
  const L = String(letter ?? "").toUpperCase();
  if (!/^[A-Z]$/.test(L) || st.guessed.includes(L)) return { ok: false };
  const late = st.deadline != null && Date.now() > st.deadline + 1500;
  const guessed = late ? st.guessed : [...st.guessed, L];
  const wrong = late ? st.wrong : st.wrong + (st.word.includes(L) ? 0 : 1);
  const solved = !late && !maskWord(st.word, guessed).includes("_");
  const lost = late || (st.lives > 0 && wrong >= st.lives);
  const setterWins = st.setter !== "chichi" ? st.setter : null;
  await db
    .update(G)
    .set({
      state: { ...st, guessed, wrong, solvedBy: solved ? me.id : null },
      status: solved || lost ? "done" : "active",
      winnerUserId: solved ? me.id : lost ? setterWins : null,
      updatedAt: new Date(),
    })
    .where(eq(G.id, id));
  if (solved || lost) {
    await ping(
      me,
      st.setter === "chichi"
        ? solved
          ? `🔤 ${me.name} finished Chichi's word "${st.word}"!`
          : `🔤 Out of ${late ? "time" : "lives"}! The word was "${st.word}"`
        : solved
          ? `🔤 ${me.name} guessed your word "${st.word}"!`
          : `🔤 ${me.name} couldn't guess "${st.word}". You win!`,
    );
  }
  refresh();
  return { ok: true };
}

/** The clock ran out on a timed word round. */
export async function wordTimeout(id: string) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.kind !== "word" || g.status !== "active") return { ok: false };
  const st = g.state as WordState;
  if (st.deadline == null || Date.now() < st.deadline) return { ok: false };
  await db
    .update(G)
    .set({ status: "done", winnerUserId: st.setter !== "chichi" ? st.setter : null, updatedAt: new Date() })
    .where(eq(G.id, id));
  refresh();
  return { ok: true };
}

/* ---------------- Turn timer (any turn game) ---------------- */

/** When a turn runs out of time, either phone can pass it on. */
export async function passTurn(id: string) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.status !== "active" || !g.turnUserId) return { ok: false };
  const st = g.state as { secs?: number; a?: string; b?: string; x?: string; o?: string; open?: number[] };
  const secs = Number(st.secs) || 0;
  if (!secs || Date.now() - g.updatedAt.getTime() < secs * 1000) return { ok: false };
  const p1 = st.a ?? st.x;
  const p2 = st.b ?? st.o;
  const next = g.turnUserId === p1 ? p2 : p1;
  await db
    .update(G)
    .set({ turnUserId: next ?? null, state: { ...st, ...(st.open ? { open: [] } : {}) }, updatedAt: new Date() })
    .where(and(eq(G.id, id), eq(G.turnUserId, g.turnUserId), eq(G.status, "active")));
  refresh();
  return { ok: true };
}

/* ---------------- Memory match ---------------- */

type MemState = { cards: string[]; matched: Record<number, string>; open: number[]; a: string; b: string; score: Record<string, number>; secs: number };

export async function newMemory(size: keyof typeof MEMORY_SIZES = "medium", secs: number = 0) {
  const me = await getMe();
  const other = await partnerOf(me);
  if (!other) return { ok: false, error: "No one to play with yet" };
  const n = MEMORY_SIZES[size] ?? 16;
  const pool: string[] = [...MEMORY_FACES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const faces = pool.slice(0, n / 2);
  const deck = [...faces, ...faces];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const running = await active(me, "memory");
  if (running) await db.update(G).set({ status: "done", updatedAt: new Date() }).where(eq(G.id, running.id));
  await db.insert(G).values({
    ownerId: me.spaceId,
    kind: "memory",
    createdBy: me.id,
    turnUserId: me.id,
    state: { cards: deck, matched: {}, open: [], a: me.id, b: other, score: { [me.id]: 0, [other]: 0 }, secs: secsOk(secs) } satisfies MemState,
  });
  await ping(me, `🃏 ${me.name} started Memory Match`, "Find the matching pairs!");
  refresh();
  return { ok: true };
}

export async function flipCard(id: string, idx: number) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.kind !== "memory" || g.status !== "active") return { ok: false, error: "This game is over" };
  if (g.turnUserId !== me.id) return { ok: false, error: "Not your turn yet" };
  const st = g.state as MemState;
  if (!Number.isInteger(idx) || idx < 0 || idx >= st.cards.length || st.matched[idx]) return { ok: false };
  // a mismatched pair from the last turn stays face up until the next flip
  let open = st.open.length >= 2 ? [] : [...st.open];
  if (open.includes(idx)) return { ok: false };
  open = [...open, idx];
  let matched = st.matched;
  let score = st.score;
  let turn: string = me.id;
  let status = "active";
  let winner: string | null = null;
  if (open.length === 2) {
    const [x, y] = open;
    if (st.cards[x] === st.cards[y]) {
      matched = { ...matched, [x]: me.id, [y]: me.id };
      score = { ...score, [me.id]: (score[me.id] ?? 0) + 1 };
      open = [];
      if (Object.keys(matched).length === st.cards.length) {
        status = "done";
        const other = me.id === st.a ? st.b : st.a;
        winner = score[me.id] > (score[other] ?? 0) ? me.id : score[me.id] < (score[other] ?? 0) ? other : null;
      }
    } else {
      turn = me.id === st.a ? st.b : st.a;
    }
  }
  await db
    .update(G)
    .set({ state: { ...st, open, matched, score }, turnUserId: status === "done" ? null : turn, status, winnerUserId: winner, updatedAt: new Date() })
    .where(eq(G.id, id));
  if (status === "done") await ping(me, winner === me.id ? `🃏 ${me.name} won Memory Match!` : winner ? "🃏 You won Memory Match! 🎉" : "🃏 Memory Match: it's a tie!");
  else if (turn !== me.id) await ping(me, `🃏 Your turn in Memory Match!`);
  refresh();
  return { ok: true };
}

/* ---------------- Dots and boxes ---------------- */

type BoxState = { lines: Record<string, string>; boxes: Record<string, string>; a: string; b: string; last: string | null; secs: number };

export async function newBoxes(secs: number = 0) {
  const me = await getMe();
  const other = await partnerOf(me);
  if (!other) return { ok: false, error: "No one to play with yet" };
  const running = await active(me, "boxes");
  if (running) await db.update(G).set({ status: "done", updatedAt: new Date() }).where(eq(G.id, running.id));
  await db.insert(G).values({ ownerId: me.spaceId, kind: "boxes", createdBy: me.id, turnUserId: me.id, state: { lines: {}, boxes: {}, a: me.id, b: other, last: null, secs: secsOk(secs) } satisfies BoxState });
  await ping(me, `🟥 ${me.name} started Dots and Boxes`, "Close a box to score!");
  refresh();
  return { ok: true };
}

export async function drawLine(id: string, key: string) {
  const me = await getMe();
  const g = await mine(me, id);
  if (!g || g.kind !== "boxes" || g.status !== "active") return { ok: false, error: "This game is over" };
  if (g.turnUserId !== me.id) return { ok: false, error: "Not your turn yet" };
  const st = g.state as BoxState;
  if (!lineValid(key) || st.lines[key]) return { ok: false, error: "Pick an empty line" };
  const lines = { ...st.lines, [key]: me.id };
  const boxes = { ...st.boxes };
  let scored = 0;
  for (const [r, c] of boxesTouching(key)) {
    if (boxLines(r, c).every((k) => lines[k]) && !boxes[`${r},${c}`]) {
      boxes[`${r},${c}`] = me.id;
      scored++;
    }
  }
  const other = me.id === st.a ? st.b : st.a;
  const done = Object.keys(boxes).length === BOX_N * BOX_N;
  let winner: string | null = null;
  if (done) {
    const mineN = Object.values(boxes).filter((v) => v === me.id).length;
    const theirs = BOX_N * BOX_N - mineN;
    winner = mineN > theirs ? me.id : mineN < theirs ? other : null;
  }
  await db
    .update(G)
    .set({ state: { ...st, lines, boxes, last: key }, turnUserId: done ? null : scored ? me.id : other, status: done ? "done" : "active", winnerUserId: winner, updatedAt: new Date() })
    .where(eq(G.id, id));
  if (done) await ping(me, winner === me.id ? `🟥 ${me.name} won Dots and Boxes!` : winner ? "🟥 You won Dots and Boxes! 🎉" : "🟥 Dots and Boxes: it's a tie!");
  else if (!scored) await ping(me, "🟥 Your turn in Dots and Boxes!");
  refresh();
  return { ok: true };
}
