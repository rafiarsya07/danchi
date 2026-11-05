import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Auth tables (shape required by Better Auth)                         */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // "owner" can change everything, "viewer" can only look.
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Danchi data. Every row belongs to the owner's space (owner_id).     */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  monthlyBudgetCents: integer("monthly_budget_cents").notNull().default(120000),
  currency: text("currency").notNull().default("RM"),
  // Reminders & notifications
  emailDigest: boolean("email_digest").notNull().default(true),
  emailReminders: boolean("email_reminders").notNull().default(true),
  digestHour: integer("digest_hour").notNull().default(8), // local hour, -1 = off
  nudgeHour: integer("nudge_hour").notNull().default(20), // evening "tasks still open" nudge, -1 = off
  lastDigestOn: date("last_digest_on"),
  lastNudgeOn: date("last_nudge_on"),
  // "Chichi Island" pinned status notification on the phone
  pinnedStatus: boolean("pinned_status").notNull().default(false),
  lastPinnedText: text("last_pinned_text"),
  lastPinnedAt: timestamp("last_pinned_at", { withTimezone: true }),
  // Privacy: sections the viewer (Rafi) can't open. Her call, always.
  hiddenSections: jsonb("hidden_sections").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  shareReminders: boolean("share_reminders").notNull().default(true), // Rafi's phone also rings for her reminders
  shareMood: boolean("share_mood").notNull().default(true),
  cycleTellRafi: boolean("cycle_tell_rafi").notNull().default(false), // a gentle "be extra sweet" heads up, no details
  // Comfort: quiet hours (local), pushes arrive silently. Safety alerts always ring.
  quietFrom: integer("quiet_from").notNull().default(23), // -1 = off
  quietTo: integer("quiet_to").notNull().default(7),
  lastCycleNoticeOn: date("last_cycle_notice_on"),
  // Safety: her emergency card
  emergency: jsonb("emergency").$type<EmergencyCard>(),
  // Home cards she turned off (customizable dashboard)
  homeHidden: jsonb("home_hidden")
    .$type<string[]>()
    .notNull()
    .default(sql`'["tips","stuff","papers","bills","meals","learning","projects","money","ask"]'::jsonb`),
  shopBudgetCents: integer("shop_budget_cents").notNull().default(0), // 0 = no separate shopping budget
  // SOS: phone numbers that get an automatic call + SMS when she presses SOS 3 times
  sosNumbers: jsonb("sos_numbers").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // SOS camera: OFF unless she turns it on herself. Her camera, her choice.
  sosCamera: boolean("sos_camera").notNull().default(false),
  // The day they got together (love chat shows "Day 812 together")
  togetherSince: date("together_since"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type EmergencyCard = {
  bloodType?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
  notes?: string;
  contacts?: { name: string; relation?: string; phone: string }[];
};

export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueOn: date("due_on"),
    priority: text("priority").notNull().default("normal"), // low | normal | high
    repeat: text("repeat").notNull().default("none"), // none | daily | weekly | monthly: a new copy appears when it's done
    projectId: uuid("project_id").references((): AnyPgColumn => project.id, { onDelete: "set null" }),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("task_owner_idx").on(t.ownerId, t.done)],
);

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"), // beauty | food | clothes | home | other
    location: text("location"),
    quantity: integer("quantity").notNull().default(1),
    lowAt: integer("low_at").notNull().default(1),
    expiresOn: date("expires_on"),
    priceCents: integer("price_cents"),
    kind: text("kind"), // finer type: makeup, skincare, hijab, fridge, freezer...
    brand: text("brand"),
    boughtOn: date("bought_on"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("item_owner_idx").on(t.ownerId, t.category)],
);

export const shoppingItem = pgTable(
  "shopping_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    itemId: uuid("item_id").references(() => item.id, { onDelete: "set null" }),
    priority: text("priority").notNull().default("need"), // urgent | need | maybe
    done: boolean("done").notNull().default(false),
    priceCents: integer("price_cents"),
    store: text("store"),
    boughtAt: timestamp("bought_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("shopping_owner_idx").on(t.ownerId, t.done)],
);

export const transaction = pgTable(
  "money_tx",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("expense"), // expense | income
    amountCents: integer("amount_cents").notNull(),
    category: text("category").notNull().default("other"),
    note: text("note"),
    projectId: uuid("project_id").references((): AnyPgColumn => project.id, { onDelete: "set null" }),
    occurredOn: date("occurred_on").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("money_owner_date_idx").on(t.ownerId, t.occurredOn)],
);

/* ------------------------------------------------------------------ */
/* Reminders, notifications, push & AI                                 */
/* ------------------------------------------------------------------ */

export const reminder = pgTable(
  "reminder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note"),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    repeat: text("repeat").notNull().default("none"), // none | daily | weekly | monthly
    taskId: uuid("task_id").references(() => task.id, { onDelete: "cascade" }),
    // Automatic reminders made by other modules disappear with their source
    assignmentId: uuid("assignment_id").references((): AnyPgColumn => assignment.id, { onDelete: "cascade" }),
    examId: uuid("exam_id").references((): AnyPgColumn => exam.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id").references((): AnyPgColumn => habit.id, { onDelete: "cascade" }),
    billId: uuid("bill_id").references((): AnyPgColumn => bill.id, { onDelete: "cascade" }),
    paperId: uuid("paper_id").references((): AnyPgColumn => paper.id, { onDelete: "cascade" }),
    debtId: uuid("debt_id").references((): AnyPgColumn => debt.id, { onDelete: "cascade" }),
    done: boolean("done").notNull().default(false),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("reminder_due_idx").on(t.done, t.remindAt), index("reminder_owner_idx").on(t.ownerId)],
);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("info"), // reminder | digest | nudge | low | test | info
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notification_owner_idx").on(t.ownerId, t.createdAt)],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastOkAt: timestamp("last_ok_at"),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

export const aiMessage = pgTable(
  "ai_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | model
    text: text("text").notNull(),
    actions: jsonb("actions").$type<string[]>(),
    sources: jsonb("sources").$type<{ title: string; url: string }[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_user_idx").on(t.userId, t.createdAt)],
);

/** Little things Chichi remembers about her: wishes, likes, goals, dates. */
export const aiMemory = pgTable(
  "ai_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("note"), // wish | like | dislike | goal | date | note
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_memory_owner_idx").on(t.ownerId)],
);

/* ------------------------------------------------------------------ */
/* More of Danchi: study, kitchen, habits, notes, bills, projects, wishes */
/* ------------------------------------------------------------------ */

const owner = () =>
  text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("📁"),
    color: text("color").notNull().default("sun"),
    status: text("status").notNull().default("active"), // active | paused | done
    dueOn: date("due_on"),
    description: text("description"),
    team: jsonb("team").$type<{ name: string; role?: string; contact?: string }[]>().notNull().default(sql`'[]'::jsonb`),
    links: jsonb("links").$type<{ title: string; url: string }[]>().notNull().default(sql`'[]'::jsonb`),
    checklist: jsonb("checklist").$type<{ t: string; done: boolean }[]>().notNull().default(sql`'[]'::jsonb`), // submission checklist
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("project_owner_idx").on(t.ownerId)],
);

export const course = pgTable(
  "course",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(),
    code: text("code"),
    color: text("color").notNull().default("sky"),
    semester: text("semester"),
    lecturer: text("lecturer"),
    room: text("room"),
    schedule: text("schedule"), // free text, e.g. "Mon 10:00, Wed 14:00"
    checklist: jsonb("checklist").$type<{ t: string; done: boolean }[]>().notNull().default(sql`'[]'::jsonb`), // revision checklist
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("course_owner_idx").on(t.ownerId)],
);

export const assignment = pgTable(
  "assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    courseId: uuid("course_id").references(() => course.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("todo"), // todo | doing | done
    weight: text("weight"),
    notes: text("notes"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("assignment_owner_idx").on(t.ownerId, t.status)],
);

export const exam = pgTable(
  "exam",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    courseId: uuid("course_id").references(() => course.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    room: text("room"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("exam_owner_idx").on(t.ownerId, t.at)],
);

export const deck = pgTable(
  "deck",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    courseId: uuid("course_id").references(() => course.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("flashcards"), // flashcards | quiz | midterm | pastyear | practice
    year: text("year"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("deck_owner_idx").on(t.ownerId)],
);

export const card = pgTable(
  "card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => deck.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    dueOn: date("due_on").notNull().defaultNow(),
    intervalDays: integer("interval_days").notNull().default(0),
    ease: real("ease").notNull().default(2.5),
    reps: integer("reps").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("card_deck_idx").on(t.deckId, t.dueOn)],
);

export const note = pgTable(
  "note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    kind: text("kind").notNull().default("note"), // note | journal
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    mood: integer("mood"), // journal: 1..5
    tags: text("tags"),
    pinned: boolean("pinned").notNull().default(false),
    // Private pages never show to the viewer, whatever the sharing settings say.
    private: boolean("private").notNull().default(false),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => course.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("note_owner_idx").on(t.ownerId, t.kind)],
);

export const habit = pgTable(
  "habit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🌱"),
    color: text("color").notNull().default("mint"),
    perWeek: integer("per_week").notNull().default(7),
    remindTime: text("remind_time"), // "HH:MM", daily reminder when set
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("habit_owner_idx").on(t.ownerId)],
);

export const habitLog = pgTable(
  "habit_log",
  {
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    ownerId: owner(),
    day: date("day").notNull(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.day] })],
);

export const recipe = pgTable(
  "recipe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    title: text("title").notNull(),
    emoji: text("emoji").notNull().default("🍳"),
    ingredients: text("ingredients").notNull().default(""), // one per line
    steps: text("steps").notNull().default(""),
    minutes: integer("minutes"),
    servings: integer("servings"),
    tags: text("tags"),
    favorite: boolean("favorite").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("recipe_owner_idx").on(t.ownerId)],
);

export const mealPlan = pgTable(
  "meal_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    day: date("day").notNull(),
    slot: text("slot").notNull(), // breakfast | lunch | dinner | snack
    recipeId: uuid("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    text: text("text"),
  },
  (t) => [uniqueIndex("meal_plan_slot_idx").on(t.ownerId, t.day, t.slot)],
);

export const bill = pgTable(
  "bill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("bill"), // bill | subscription
    amountCents: integer("amount_cents").notNull(),
    category: text("category").notNull().default("bills"),
    cycle: text("cycle").notNull().default("monthly"), // weekly | monthly | yearly | once
    nextDue: date("next_due").notNull(),
    remindDaysBefore: integer("remind_days_before").notNull().default(2),
    active: boolean("active").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("bill_owner_idx").on(t.ownerId, t.nextDue)],
);

export const wish = pgTable(
  "wish",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(),
    priceCents: integer("price_cents"),
    link: text("link"),
    priority: text("priority").notNull().default("want"), // dream | want | need
    note: text("note"),
    got: boolean("got").notNull().default(false),
    gotAt: timestamp("got_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("wish_owner_idx").on(t.ownerId, t.got)],
);


/* ------------------------------------------------------------------ */
/* v0.5: papers, files, debts, safety, comfort, privacy                */
/* ------------------------------------------------------------------ */

/** Documents (passport, visa, IC...) and applications (scholarships, internships...). */
export const paper = pgTable(
  "paper",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    kind: text("kind").notNull().default("document"), // document | application
    category: text("category").notNull().default("other"),
    title: text("title").notNull(),
    org: text("org"),
    // Never the full number. Only a hint like the last 4 characters.
    refHint: text("ref_hint"),
    expiresOn: date("expires_on"),
    deadlineOn: date("deadline_on"),
    status: text("status").notNull().default("idea"), // application: idea | preparing | submitted | interview | offer | rejected
    link: text("link"),
    notes: text("notes"),
    checklist: jsonb("checklist").$type<{ t: string; done: boolean }[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("paper_owner_idx").on(t.ownerId, t.kind)],
);

/** Private uploads. Stored on the mini PC disk, only served to signed in people. */
export const file = pgTable(
  "file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    refType: text("ref_type").notNull(), // paper | note | course | project
    refId: uuid("ref_id").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    storedName: text("stored_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("file_ref_idx").on(t.refType, t.refId)],
);

export const debt = pgTable(
  "debt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    person: text("person").notNull(),
    direction: text("direction").notNull().default("owes_me"), // owes_me | i_owe
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    dueOn: date("due_on"),
    settled: boolean("settled").notNull().default(false),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("debt_owner_idx").on(t.ownerId, t.settled)],
);

/** Safety check ins: home safe, on my way, need you, and the safe arrival timer. */
export const checkin = pgTable(
  "checkin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    kind: text("kind").notNull(), // safe | omw | help | timer
    message: text("message"),
    lat: real("lat"),
    lng: real("lng"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("sent"), // sent | active | safe | alerted | cancelled
    nudgedAt: timestamp("nudged_at", { withTimezone: true }),
    alertedAt: timestamp("alerted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("checkin_owner_idx").on(t.ownerId, t.createdAt), index("checkin_active_idx").on(t.status, t.dueAt)],
);

/** Little notes from Rafi. The one thing the viewer can write. */
export const loveNote = pgTable(
  "love_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    emoji: text("emoji").notNull().default("💌"),
    kind: text("kind").notNull().default("note"), // note | miss | pap (photo) | papask
    replyToId: uuid("reply_to_id"),
    reaction: text("reaction"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("love_owner_idx").on(t.ownerId, t.createdAt)],
);

export const moodLog = pgTable(
  "mood_log",
  {
    ownerId: owner(),
    day: date("day").notNull(),
    mood: integer("mood").notNull(), // 1..5
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.day] })],
);

export const cycleLog = pgTable(
  "cycle_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    startOn: date("start_on").notNull(),
    endOn: date("end_on"),
    flow: text("flow"), // light | medium | heavy
    symptoms: text("symptoms"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cycle_start_idx").on(t.ownerId, t.startOn)],
);

/** When the viewer opened which section. She can always see this. */
export const visitLog = pgTable(
  "visit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visit_owner_idx").on(t.ownerId, t.at)],
);

/** Optional PIN lock per person, on top of the Google sign in. */
export const userLock = pgTable("user_lock", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  pinHash: text("pin_hash").notNull(),
  lockMinutes: integer("lock_minutes").notNull().default(15),
  failed: integer("failed").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Her evening wrap up: when she finished it, and "nothing spent today". */
export const dailyCheck = pgTable(
  "daily_check",
  {
    ownerId: owner(),
    day: date("day").notNull(),
    noSpend: boolean("no_spend").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.day] })],
);


/* ------------------------------------------------------------------ */
/* v0.8: usage, prices, savings, learning                              */
/* ------------------------------------------------------------------ */

/** Every +1 / -1 on an item, so Danchi knows how fast she uses things. */
export const itemUse = pgTable(
  "item_use",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("item_use_idx").on(t.itemId, t.at)],
);

/** What something cost where, for price comparison. */
export const priceLog = pgTable(
  "price_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(), // lower case product name
    store: text("store"),
    priceCents: integer("price_cents").notNull(),
    on: date("on").notNull().defaultNow(),
  },
  (t) => [index("price_log_idx").on(t.ownerId, t.name)],
);

export const savingsGoal = pgTable(
  "savings_goal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🐷"),
    targetCents: integer("target_cents").notNull(),
    savedCents: integer("saved_cents").notNull().default(0),
    dueOn: date("due_on"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("savings_owner_idx").on(t.ownerId)],
);

/** Learning and self development: goals, courses, books, skills, certificates, resources. */
export const learning = pgTable(
  "learning",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    kind: text("kind").notNull().default("goal"), // goal | course | book | article | video | skill | certificate | resource
    title: text("title").notNull(),
    link: text("link"),
    status: text("status").notNull().default("doing"), // want | doing | done
    progress: integer("progress").notNull().default(0), // 0..100
    level: integer("level"), // skills: 1..5
    notes: text("notes"),
    dueOn: date("due_on"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("learning_owner_idx").on(t.ownerId, t.kind)],
);

/** Minutes learned per day, for the weekly learning journal. */
export const learningLog = pgTable(
  "learning_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    learningId: uuid("learning_id").references(() => learning.id, { onDelete: "set null" }),
    day: date("day").notNull(),
    minutes: integer("minutes").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("learning_log_idx").on(t.ownerId, t.day)],
);

/**
 * SOS: she pressed the red button 3 times. While it's active her phone keeps
 * sending her location, photos from both cameras are attached, and Rafi's
 * phones are called. The token gives a no-login live page for the SMS link.
 */
export const sos = pgTable(
  "sos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("active"), // active | ended
    lat: real("lat"),
    lng: real("lng"),
    accuracy: real("accuracy"),
    battery: integer("battery"),
    lastAt: timestamp("last_at", { withTimezone: true }),
    calls: jsonb("calls").$type<{ to: string; kind: "call" | "sms"; ok: boolean; info?: string }[]>().notNull().default(sql`'[]'::jsonb`),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sos_owner_idx").on(t.ownerId, t.createdAt)],
);

export const sosPoint = pgTable(
  "sos_point",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    sosId: uuid("sos_id")
      .notNull()
      .references(() => sos.id, { onDelete: "cascade" }),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    accuracy: real("accuracy"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sos_point_idx").on(t.sosId, t.at)],
);

/** Cozy corner: focus sessions (pomodoro). */
export const focusSession = pgTable(
  "focus_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    label: text("label"),
    minutes: integer("minutes").notNull(),
    day: date("day").notNull(),
    courseId: uuid("course_id").references(() => course.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("focus_owner_idx").on(t.ownerId, t.day)],
);

/** Cozy corner: the happy jar. Little good moments, from her or from Rafi. */
export const jarNote = pgTable(
  "jar_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    fromUserId: text("from_user_id").references(() => user.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    emoji: text("emoji").notNull().default("⭐"),
    day: date("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jar_owner_idx").on(t.ownerId, t.createdAt)],
);

/** Cozy corner: countdowns to days she's looking forward to. */
export const countdown = pgTable(
  "countdown",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    title: text("title").notNull(),
    emoji: text("emoji").notNull().default("🎉"),
    day: date("day").notNull(),
    yearly: boolean("yearly").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("countdown_owner_idx").on(t.ownerId, t.day)],
);

/** Stickers they made themselves from a photo (shared by both). */
export const loveSticker = pgTable(
  "love_sticker",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    fileId: uuid("file_id").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("love_sticker_owner_idx").on(t.ownerId, t.createdAt)],
);

/** Little games for two: tic tac toe, rock paper scissors, this or that, daily question. */
export const game = pgTable(
  "game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    kind: text("kind").notNull(), // ttt | rps | tot | question
    state: jsonb("state").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("active"), // active | done
    turnUserId: text("turn_user_id"),
    winnerUserId: text("winner_user_id"), // null + done = draw
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    day: date("day"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("game_owner_idx").on(t.ownerId, t.kind, t.createdAt)],
);

/** Per person chat look: a preset ("p:sunset") or their own photo ("f:<file id>"). */
export const chatPref = pgTable("chat_pref", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bg: text("bg").notNull().default("p:cream"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Their shared bucket list: things to do together someday. */
export const bucket = pgTable(
  "bucket",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    title: text("title").notNull(),
    emoji: text("emoji").notNull().default("✨"),
    addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bucket_owner_idx").on(t.ownerId, t.createdAt)],
);

/** Their Spotify playlists (they have two), for listening together. */
export const playlist = pgTable(
  "playlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: owner(),
    name: text("name").notNull(),
    uri: text("uri").notNull(), // spotify:playlist:ID (or album)
    addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("playlist_owner_idx").on(t.ownerId)],
);

/** One "listen together" session per couple. The DJ's phone keeps it in sync. */
export const listen = pgTable("listen", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(false),
  playlistName: text("playlist_name"),
  playlistUri: text("playlist_uri"),
  trackUri: text("track_uri"),
  positionMs: integer("position_ms").notNull().default(0),
  paused: boolean("paused").notNull().default(false),
  djUserId: text("dj_user_id"),
  listeners: jsonb("listeners").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // a picked song bumps seq, every phone loads it; queue = what plays next
  seq: integer("seq").notNull().default(0),
  queue: jsonb("queue").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Spotify connection (Rafi's account) so Danchi can list their playlists' songs and search. */
export const spotifyAuth = pgTable("spotify_auth", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  connectedBy: text("connected_by").references(() => user.id, { onDelete: "set null" }),
  displayName: text("display_name"),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Each person's own Spotify, so Danchi can play songs in their Spotify app (full songs, screen off too). */
export const spotifyMe = pgTable("spotify_me", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  spaceId: text("space_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // play in the Spotify app (true) or the small Danchi player (false)
  useApp: boolean("use_app").notNull().default(true),
  // why the last play didn't reach the phone: no-device, premium, auth
  problem: text("problem"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
