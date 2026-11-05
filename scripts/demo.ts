/**
 * Optional: fills the owner's Danchi with a few sample rows so it doesn't look empty.
 *   npm run demo
 * Safe to skip. Delete the rows from inside the app any time.
 */
import { eq } from "drizzle-orm";
import { addDaysISO, todayISO } from "../src/lib/format";
import { zonedToUtc } from "../src/lib/time";
import { assignmentReminders, billReminders, examReminders, debtReminders, paperReminders } from "../src/server/mutations";
import { db, schema, sql } from "./db";

// Dates in the app's timezone (not the computer's), so "today" really is today.
function day(offset: number) {
  return addDaysISO(todayISO(), offset);
}

async function main() {
  const [owner] = await db.select().from(schema.user).where(eq(schema.user.role, "owner")).limit(1);
  if (!owner) throw new Error("Run `npm run seed` first.");
  const ownerId = owner.id;

  // Run it twice and you'd get everything twice. Only fill an empty Danchi.
  const [existing] = await db.select({ id: schema.task.id }).from(schema.task).where(eq(schema.task.ownerId, ownerId)).limit(1);
  if (existing && !process.argv.includes("--force")) {
    console.log("Danchi already has data, so the samples were skipped. (npm run demo -- --force to add them anyway)");
    await sql.end();
    return;
  }

  await db.insert(schema.task).values([
    { ownerId, title: "Skincare", done: true, doneAt: new Date() },
    { ownerId, title: "Pay phone bill", dueOn: day(0), priority: "high" },
    { ownerId, title: "Quiz 3 prep", dueOn: day(1) },
    { ownerId, title: "Laundry day", dueOn: day(5) },
  ]);
  await db.insert(schema.item).values([
    { ownerId, name: "Fresh milk", category: "food", location: "Fridge", quantity: 1, lowAt: 0, expiresOn: day(2) },
    { ownerId, name: "Eggs", category: "food", location: "Fridge", quantity: 2, lowAt: 3 },
    { ownerId, name: "Sunscreen", category: "beauty", location: "Bathroom", quantity: 1, lowAt: 0, expiresOn: day(12) },
    { ownerId, name: "Shampoo", category: "beauty", location: "Bathroom", quantity: 1, lowAt: 1 },
    { ownerId, name: "Cream hijab", category: "clothes", location: "Wardrobe", quantity: 3, lowAt: 0 },
    { ownerId, name: "Dish soap", category: "home", location: "Kitchen", quantity: 2, lowAt: 1 },
  ]);
  await db.insert(schema.shoppingItem).values([
    { ownerId, name: "Peach candle", priority: "maybe" },
  ]);
  await db.insert(schema.transaction).values([
    { ownerId, amountCents: 1250, category: "food", note: "Nasi lemak", occurredOn: day(0) },
    { ownerId, amountCents: 3800, category: "bills", note: "Phone bill", occurredOn: day(-1) },
    { ownerId, amountCents: 2490, category: "beauty", note: "Lip tint", occurredOn: day(-2) },
  ]);
  await db.insert(schema.reminder).values([
    { ownerId, title: "Drink water 💧", remindAt: zonedToUtc(day(0), "15:00"), repeat: "daily" },
    { ownerId, title: "Call mama", remindAt: zonedToUtc(day(1), "20:30") },
    { ownerId, title: "Pay rent", remindAt: zonedToUtc(day(6), "09:00"), repeat: "monthly", note: "RM 450 to landlord" },
  ]);
  await db.insert(schema.notification).values([
    { ownerId, kind: "info", title: "Welcome home! 🌼", body: "I'm Chichi. I'll remind you of everything, promise.", url: "/ask" },
  ]);
  // Study
  const [course] = await db.insert(schema.course).values({ ownerId, name: "Data Structures", code: "WIA1002", color: "sky", room: "DK3", schedule: "Mon 10:00, Wed 14:00", lecturer: "Dr. Aisyah" }).returning();
  await db.insert(schema.course).values({ ownerId, name: "Statistics", code: "WIA1003", color: "pink" });
  const [asg] = await db.insert(schema.assignment).values({ ownerId, courseId: course.id, title: "Linked list lab report", dueAt: zonedToUtc(day(2), "23:59"), weight: "10%" }).returning();
  await assignmentReminders(db, ownerId, { id: asg.id, title: asg.title, dueAt: asg.dueAt, done: false });
  const [ex] = await db.insert(schema.exam).values({ ownerId, courseId: course.id, title: "Midterm", at: zonedToUtc(day(9), "09:00"), room: "DK1" }).returning();
  await examReminders(db, ownerId, { id: ex.id, title: ex.title, at: ex.at, room: ex.room });
  const [deck] = await db.insert(schema.deck).values({ ownerId, name: "Big O cheatsheet", courseId: course.id }).returning();
  await db.insert(schema.card).values([
    { ownerId, deckId: deck.id, front: "Binary search", back: "O(log n)" },
    { ownerId, deckId: deck.id, front: "Inserting at the head of a linked list", back: "O(1)" },
    { ownerId, deckId: deck.id, front: "Bubble sort, worst case", back: "O(n²)" },
  ]);
  // Habits
  const habits = await db
    .insert(schema.habit)
    .values([
      { ownerId, name: "Drink water", emoji: "💧", color: "sky" },
      { ownerId, name: "Skincare night routine", emoji: "🧴", color: "pink", remindTime: "22:00" },
      { ownerId, name: "Read 10 pages", emoji: "📖", color: "sun", perWeek: 5 },
    ])
    .returning();
  await db.insert(schema.habitLog).values([1, 2, 3].map((n) => ({ habitId: habits[0].id, ownerId, day: day(-n) })));
  await db.insert(schema.habitLog).values([1, 2].map((n) => ({ habitId: habits[1].id, ownerId, day: day(-n) })));
  // Kitchen
  await db.insert(schema.recipe).values([
    { ownerId, title: "Egg fried rice", emoji: "🍳", minutes: 15, favorite: true, ingredients: "2 eggs\n1 cup rice\nsoy sauce\nspring onion", steps: "Scramble the eggs\nAdd cold rice\nSoy sauce, toss, done" },
    { ownerId, title: "Milk tea", emoji: "🧋", minutes: 5, ingredients: "fresh milk\ntea bag\nsugar", steps: "Brew the tea strong\nAdd milk and sugar" },
  ]);
  await db.insert(schema.mealPlan).values({ ownerId, day: day(0), slot: "dinner", text: "Egg fried rice" });
  // Bills, wishes, project, notes
  const bills = await db
    .insert(schema.bill)
    .values([
      { ownerId, name: "Phone bill", amountCents: 3800, nextDue: day(3), category: "bills" },
      { ownerId, name: "Spotify", kind: "subscription", amountCents: 1590, nextDue: day(12), category: "fun" },
    ])
    .returning();
  for (const b of bills) await billReminders(db, ownerId, b);
  await db.insert(schema.wish).values([
    { ownerId, name: "Film camera", priceCents: 45000, priority: "dream" },
    { ownerId, name: "Laneige lip mask", priceCents: 9900, priority: "want" },
  ]);
  const [proj] = await db.insert(schema.project).values({ ownerId, name: "Group presentation", emoji: "🎤", color: "lilac", dueOn: day(10), description: "Statistics group project with Mira and Hana" }).returning();
  await db.insert(schema.task).values([
    { ownerId, title: "Make the slides", projectId: proj.id, dueOn: day(6) },
    { ownerId, title: "Collect survey data", projectId: proj.id, done: true, doneAt: new Date() },
  ]);
  await db.insert(schema.note).values([
    { ownerId, kind: "note", title: "Presentation ideas", body: "Open with a fun poll\nKeep slides short", projectId: proj.id, tags: "uni, ideas", pinned: true },
    { ownerId, kind: "journal", body: "Finished the survey today and had bubble tea with Hana. Good day!", mood: 5, private: true },
  ]);
  const papers = await db
    .insert(schema.paper)
    .values([
      { ownerId, kind: "document", category: "passport", title: "My passport", refHint: "4821", expiresOn: day(50) },
      { ownerId, kind: "document", category: "student", title: "Student card", expiresOn: day(400) },
      {
        ownerId,
        kind: "application",
        category: "scholarship",
        title: "Dean's list scholarship",
        org: "Faculty of Science",
        deadlineOn: day(9),
        status: "preparing",
        checklist: [
          { t: "Transcript", done: true },
          { t: "Personal essay", done: false },
          { t: "Recommendation letter", done: false },
        ],
      },
    ])
    .returning();
  for (const p of papers) await paperReminders(db, ownerId, p);
  const [debt] = await db.insert(schema.debt).values({ ownerId, person: "Hana", direction: "owes_me", amountCents: 2500, note: "Bubble tea and movie", dueOn: day(4) }).returning();
  await debtReminders(db, ownerId, debt);
  await db.insert(schema.moodLog).values([{ ownerId, day: day(-1), mood: 4 }]).onConflictDoNothing();
  await db.insert(schema.cycleLog).values([
    { ownerId, startOn: day(-50), endOn: day(-46), flow: "medium" },
    { ownerId, startOn: day(-22), endOn: day(-18), flow: "medium", symptoms: "Cramps, Tired" },
  ]).onConflictDoNothing();
  const [viewer] = await db.select().from(schema.user).where(eq(schema.user.role, "viewer")).limit(1);
  if (viewer) {
    await db.insert(schema.loveNote).values({ ownerId, fromUserId: viewer.id, emoji: "🌼", text: "Good luck with Quiz 3 tomorrow! You studied so hard, I'm proud of you. Bubble tea after? 🧋" });
  }
  console.log("Sample data added.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await sql.end();
  process.exit(1);
});
