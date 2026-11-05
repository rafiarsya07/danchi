/** Questions and pairs for the couple games. Light, sweet, a little bit silly. */

export const QUESTIONS = [
  "What's one small thing I do that always makes you smile?",
  "If we could teleport anywhere for one day, where would we go?",
  "What was your first impression of me? Be honest 😆",
  "What's a song that reminds you of us?",
  "What's your favourite memory of us so far?",
  "What food should we cook together next?",
  "What's something new you want us to try together this month?",
  "What do you love most about our little routines?",
  "If our love story was a movie, what would it be called?",
  "What's one thing you're proud of yourself for this week?",
  "What's your dream lazy Sunday with me?",
  "Which three words describe us best?",
  "What's a habit of mine you secretly find cute?",
  "Where do you see us in 5 years?",
  "What's the best gift you've ever gotten (from anyone)?",
  "What makes you feel most loved: words, time, touch, gifts or help?",
  "What's something you've never told me but want to?",
  "What's your comfort food when you're sad?",
  "Which animal would I be, and why?",
  "What's one goal you want me to cheer you on for?",
  "What's the funniest moment we've had together?",
  "If you could relive one day with me, which one?",
  "What's your favourite photo of us?",
  "What's one place in Malaysia we haven't been to but should?",
  "Tea or coffee date, and where?",
  "What's something that scares you a little, that I can help with?",
  "What do you want our future home to feel like?",
  "Which friend of ours would survive a zombie movie? 🧟",
  "What's a tiny thing I could do tomorrow to make your day better?",
  "What's one thing you learned from me?",
  "What's the sweetest message I ever sent you?",
  "What's your favourite way to spend a rainy day together?",
  "If we had a pet, what would we name it?",
  "What's one thing on your bucket list?",
  "What made you laugh today?",
  "What's your love language this week?",
  "Describe our perfect date in 3 emojis",
  "What's one thing you wish we did more often?",
  "What are you grateful for today?",
  "What should our next little adventure be?",
];

export const PAIRS: [string, string][] = [
  ["Beach 🏖️", "Mountains 🏔️"],
  ["Nasi lemak 🍛", "Mee goreng 🍜"],
  ["Movie night 🎬", "Night walk 🌙"],
  ["Cats 🐱", "Dogs 🐶"],
  ["Sunrise 🌅", "Sunset 🌇"],
  ["Text 💬", "Call 📞"],
  ["Sweet 🍰", "Spicy 🌶️"],
  ["Bubble tea 🧋", "Coffee ☕"],
  ["Stay in 🏠", "Go out 🌆"],
  ["Rainy day 🌧️", "Sunny day ☀️"],
  ["Road trip 🚗", "Plane trip ✈️"],
  ["Breakfast date 🥞", "Dinner date 🍝"],
  ["Hugs 🫂", "Kisses 😘"],
  ["Morning person ☀️", "Night owl 🦉"],
  ["Romance movie 💕", "Horror movie 👻"],
  ["Shopping mall 🛍️", "Night market 🏮"],
  ["Surprise gift 🎁", "Planned date 📅"],
  ["Pizza 🍕", "Sushi 🍣"],
  ["Summer ☀️", "Winter ❄️"],
  ["Karaoke 🎤", "Board games 🎲"],
  ["Big wedding 💒", "Small wedding 💍"],
  ["Ice cream 🍦", "Chocolate 🍫"],
  ["Photos 📸", "Videos 🎥"],
  ["Cook at home 🍳", "Eat out 🍽️"],
  ["Love letter 💌", "Voice note 🎙️"],
  ["Theme park 🎢", "Museum 🖼️"],
  ["Matching outfits 👕", "No thanks 🙈"],
  ["Spontaneous ✨", "Planned 🗒️"],
  ["Long hugs 🫶", "Cuddles on the sofa 🛋️"],
  ["Big city 🏙️", "Quiet village 🌾"],
];

export const RPS = { rock: "✊", paper: "✋", scissors: "✌️" } as const;
export type RpsPick = keyof typeof RPS;

/** Same question for both of them on the same day. */
export function questionFor(day: string) {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % QUESTIONS.length;
}

export function randomPairs(n = 6) {
  const idx = PAIRS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n);
}

export const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/* ---------------- Board games ---------------- */

export const GRID = {
  c4: { cols: 7, rows: 6, win: 4, gravity: true, name: "Connect Four" },
  gomoku: { cols: 10, rows: 10, win: 5, gravity: false, name: "Gomoku (5 in a row)" },
} as const;
export type GridKind = keyof typeof GRID;

/** Did the piece at `at` just make `need` in a row? Returns the winning cells. */
export function lineAt(board: (string | null)[], cols: number, rows: number, at: number, need: number): number[] | null {
  const mark = board[at];
  if (!mark) return null;
  const r0 = Math.floor(at / cols);
  const c0 = at % cols;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const cells = [at];
    for (const s of [1, -1]) {
      let r = r0 + dr * s;
      let c = c0 + dc * s;
      while (r >= 0 && r < rows && c >= 0 && c < cols && board[r * cols + c] === mark) {
        cells.push(r * cols + c);
        r += dr * s;
        c += dc * s;
      }
    }
    if (cells.length >= need) return cells;
  }
  return null;
}

/* ---------------- Snakes and ladders (ular tangga) ---------------- */

export const JUMPS: Record<number, number> = {
  // ladders
  3: 22,
  8: 30,
  28: 84,
  58: 77,
  75: 86,
  80: 99,
  // snakes
  17: 4,
  52: 29,
  57: 40,
  62: 22,
  88: 18,
  95: 51,
  97: 79,
};

/* ---------------- Word guess (tebak kata) ---------------- */

export const WORD_TRIES = 7;
export function maskWord(word: string, guessed: string[]) {
  return word
    .split("")
    .map((ch) => (ch === " " ? " " : guessed.includes(ch) ? ch : "_"))
    .join("");
}

/* ---------------- Chichi's word list (tebak kata) ---------------- */

const WORD_POOL = `CAT DOG SUN SEA TEA PIE JAM BEE OWL ICE KEY BUS
LOVE KISS MOON STAR CAKE MILK RICE SOUP FISH BIRD RAIN SNOW TREE ROSE BEAR DUCK FROG LION SHOE SOCK BOOK DESK LAMP BOAT KITE GIFT HOME SONG
HEART PEACH HONEY MANGO LEMON BEACH CLOUD DREAM SMILE HAPPY TEDDY BUNNY PANDA KOALA TIGER PIZZA SUSHI PASTA BREAD CANDY OCEAN RIVER PHONE MUSIC DANCE PARTY
CUDDLE COFFEE CHERRY BANANA PICNIC SUNSET GARDEN FLOWER KITTEN PUPPY BUTTER COOKIE NOODLE CAMERA GUITAR PILLOW CASTLE ISLAND PLANET ROCKET RIBBON CINEMA
SUNRISE RAINBOW BLANKET PANCAKE CUPCAKE KITCHEN DOLPHIN PENGUIN UNICORN BALLOON CHICKEN TEDDIES HOLIDAY JOURNEY LANTERN MORNING BIRTHDAY
SUNSHINE SWEETPEA MOONLITE CHOCOLATE DUMPLING STRAWBERRY BUTTERFLY ADVENTURE WATERMELON PINEAPPLE SNOWFLAKE STARLIGHT SWEETHEART HONEYMOON
FIREWORKS DANDELION CHAMPAGNE MARSHMALLOW SUNFLOWERS PLAYGROUND BLUEBERRIES CHEESECAKE SUITCASES HAPPINESS`;

export const WORDS = WORD_POOL.split(/\s+/).filter(Boolean);
export const WORD_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** A random word with exactly `len` letters (or the closest length we have). */
export function pickWord(len: number, rand: (n: number) => number) {
  for (let d = 0; d < 12; d++) {
    for (const l of [len - d, len + d]) {
      const list = WORDS.filter((w) => w.length === l);
      if (list.length) return list[rand(list.length)];
    }
  }
  return "PEACH";
}

/* ---------------- Memory match ---------------- */

export const MEMORY_FACES = ["happy", "laugh", "love", "kiss", "please", "cry", "angry", "shy", "sleepy", "wink", "shock", "cool", "yum", "party", "think", "hug", "proud", "blossom"] as const;
export const MEMORY_SIZES = { small: 12, medium: 16, big: 20 } as const;

/* ---------------- Dots and boxes ---------------- */

export const BOX_N = 4; // 4 x 4 boxes, 5 x 5 dots
export function boxLines(r: number, c: number) {
  return [`h${r}_${c}`, `h${r + 1}_${c}`, `v${r}_${c}`, `v${r}_${c + 1}`];
}
export function lineValid(k: string) {
  const m = k.match(/^([hv])(\d)_(\d)$/);
  if (!m) return false;
  const r = Number(m[2]);
  const c = Number(m[3]);
  return m[1] === "h" ? r <= BOX_N && c < BOX_N : r < BOX_N && c <= BOX_N;
}
export function boxesTouching(k: string): [number, number][] {
  const m = k.match(/^([hv])(\d)_(\d)$/)!;
  const r = Number(m[2]);
  const c = Number(m[3]);
  const out: [number, number][] = [];
  if (m[1] === "h") {
    if (r > 0) out.push([r - 1, c]);
    if (r < BOX_N) out.push([r, c]);
  } else {
    if (c > 0) out.push([r, c - 1]);
    if (c < BOX_N) out.push([r, c]);
  }
  return out;
}

export const TURN_SECS = [0, 15, 30, 60] as const;
export const LIVES = [0, 3, 5, 7, 10] as const; // 0 = unlimited
export const WORD_TIME = [0, 60, 120, 180] as const; // 0 = no time limit
