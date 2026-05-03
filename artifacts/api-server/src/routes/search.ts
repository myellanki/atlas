import { Router } from "express";
import { db } from "@workspace/db";
import {
  cardsTable, notesTable, deliverablesTable, membersTable,
  milestonesTable, teamsTable, irbSubmissionsTable,
} from "@workspace/db";
import { ilike, or, eq, sql } from "drizzle-orm";

const router = Router();

router.get("/search", async (req, res) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) return res.json({ cards: [], deliverables: [], members: [], irb: [] });

  const pattern = `%${q}%`;

  const [cards, deliverables, members, irb] = await Promise.all([
    db.select({
      id: cardsTable.id,
      title: cardsTable.title,
      status: cardsTable.status,
      priority: cardsTable.priority,
      teamId: cardsTable.teamId,
      description: cardsTable.description,
    })
      .from(cardsTable)
      .where(or(ilike(cardsTable.title, pattern), ilike(cardsTable.description, pattern)))
      .limit(20),

    db.select({
      id: deliverablesTable.id,
      title: deliverablesTable.title,
      type: deliverablesTable.type,
      status: deliverablesTable.status,
      journal: deliverablesTable.journal,
      cardId: deliverablesTable.cardId,
    })
      .from(deliverablesTable)
      .where(or(
        ilike(deliverablesTable.title, pattern),
        ilike(deliverablesTable.journal, pattern),
        ilike(deliverablesTable.firstAuthor, pattern),
      ))
      .limit(10),

    db.select({
      id: membersTable.id,
      name: membersTable.name,
      role: membersTable.role,
      teamId: membersTable.teamId,
    })
      .from(membersTable)
      .where(ilike(membersTable.name, pattern))
      .limit(8),

    db.select({
      id: irbSubmissionsTable.id,
      title: irbSubmissionsTable.title,
      protocolNumber: irbSubmissionsTable.protocolNumber,
      pi: irbSubmissionsTable.pi,
      status: irbSubmissionsTable.status,
    })
      .from(irbSubmissionsTable)
      .where(or(
        ilike(irbSubmissionsTable.title, pattern),
        ilike(irbSubmissionsTable.protocolNumber, pattern),
        ilike(irbSubmissionsTable.pi, pattern),
      ))
      .limit(8),
  ]);

  res.json({ cards, deliverables, members, irb });
});

export default router;
