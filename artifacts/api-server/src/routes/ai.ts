import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, membersTable, notesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function generateSimpleSummary(notes: { content: string }[], cardTitles: string[], dueDate?: string | null): string {
  if (notes.length === 0 && cardTitles.length === 0) return "No active work items";
  const latestNote = notes[0]?.content ?? "";
  const snippet = latestNote.length > 60 ? latestNote.slice(0, 57) + "..." : latestNote;
  if (snippet) return snippet;
  return `${cardTitles.length} task${cardTitles.length !== 1 ? "s" : ""} in progress`;
}

router.post("/ai/team-column-summary", async (req, res) => {
  const { teamId } = req.body;
  if (!teamId) return res.status(400).json({ error: "teamId required" });

  const members = await db.select().from(membersTable).where(eq(membersTable.teamId, teamId)).orderBy(membersTable.position);
  const now = new Date().toISOString().split("T")[0];

  const summaries = await Promise.all(
    members.map(async (member) => {
      const cards = await db.select().from(cardsTable).where(eq(cardsTable.assigneeId, member.id));
      const activeCards = cards.filter((c) => c.status !== "done");

      const allNotes = await Promise.all(
        activeCards.map((c) =>
          db.select().from(notesTable).where(eq(notesTable.cardId, c.id)).orderBy(desc(notesTable.createdAt)).limit(1)
        )
      );
      const latestNotes = allNotes.flat();

      const upcomingCards = activeCards
        .filter((c) => c.dueDate && c.dueDate >= now)
        .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

      const summary = generateSimpleSummary(
        latestNotes,
        activeCards.map((c) => c.title),
        upcomingCards[0]?.dueDate
      );

      return {
        memberId: member.id,
        memberName: member.name,
        summary,
        upcomingDeadline: upcomingCards[0]?.dueDate ?? null,
      };
    })
  );

  res.json(summaries);
});

router.post("/ai/card-summary", async (req, res) => {
  const { cardId } = req.body;
  if (!cardId) return res.status(400).json({ error: "cardId required" });

  const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, cardId));
  if (!card) return res.status(404).json({ error: "Card not found" });

  const notes = await db.select().from(notesTable).where(eq(notesTable.cardId, cardId)).orderBy(desc(notesTable.createdAt)).limit(3);
  const latestNote = notes[0]?.content ?? "";
  const snippet = latestNote.length > 80 ? latestNote.slice(0, 77) + "..." : latestNote;
  const summary = snippet || `${card.status.replace("_", " ")} — ${card.priority} priority`;

  res.json({ cardId, summary });
});

export default router;
