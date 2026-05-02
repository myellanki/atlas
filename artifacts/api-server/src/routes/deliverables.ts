import { Router } from "express";
import { db } from "@workspace/db";
import {
  deliverablesTable, CreateDeliverableBody, UpdateDeliverableBody,
  cardsTable, teamsTable, membersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/cards/:cardId/deliverables", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const deliverables = await db
    .select()
    .from(deliverablesTable)
    .where(eq(deliverablesTable.cardId, cardId))
    .orderBy(deliverablesTable.createdAt);
  res.json(deliverables);
});

router.post("/cards/:cardId/deliverables", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const body = CreateDeliverableBody.parse(req.body);
  const [deliverable] = await db
    .insert(deliverablesTable)
    .values({
      cardId,
      title: body.title,
      type: body.type ?? "paper",
      targetDate: body.targetDate ?? null,
      status: body.status ?? "drafting",
      journal: body.journal ?? null,
      firstAuthor: body.firstAuthor ?? null,
      doi: body.doi ?? null,
      url: body.url ?? null,
      notes: body.notes ?? null,
      publishedYear: body.publishedYear ?? null,
    })
    .returning();
  res.status(201).json(deliverable);
});

router.patch("/deliverables/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = UpdateDeliverableBody.parse(req.body);
  const [deliverable] = await db
    .update(deliverablesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(deliverablesTable.id, id))
    .returning();
  if (!deliverable) return res.status(404).json({ error: "Deliverable not found" });
  res.json(deliverable);
});

router.delete("/deliverables/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(deliverablesTable).where(eq(deliverablesTable.id, id));
  res.status(204).send();
});

// ── Publications dashboard data ───────────────────────────────────────────────
// Returns all deliverables with status=published or type=paper joined with card/team info
router.get("/publications", async (req, res) => {
  const rows = await db
    .select({
      deliverable: deliverablesTable,
      card: {
        id: cardsTable.id,
        title: cardsTable.title,
        teamId: cardsTable.teamId,
      },
    })
    .from(deliverablesTable)
    .leftJoin(cardsTable, eq(deliverablesTable.cardId, cardsTable.id))
    .orderBy(desc(deliverablesTable.publishedYear), desc(deliverablesTable.updatedAt));

  const result = rows.map(r => ({
    ...r.deliverable,
    cardTitle: r.card?.title ?? null,
    teamId: r.card?.teamId ?? null,
  }));

  res.json(result);
});

// ── Card tag update (data_source + cohort) ────────────────────────────────────
router.patch("/cards/:cardId/tags", async (req, res) => {
  const id = parseInt(req.params.cardId);
  const body = req.body as { dataSource?: string | null; cohort?: string | null };
  const [card] = await db
    .update(cardsTable)
    .set({
      ...(body.dataSource !== undefined && { dataSource: body.dataSource }),
      ...(body.cohort !== undefined && { cohort: body.cohort }),
      updatedAt: new Date(),
    })
    .where(eq(cardsTable.id, id))
    .returning();
  if (!card) return res.status(404).json({ error: "Card not found" });
  res.json({ id: card.id, dataSource: card.dataSource, cohort: card.cohort });
});

export default router;
