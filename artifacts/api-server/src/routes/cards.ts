import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, cardLabelsTable, labelsTable, notesTable, checklistItemsTable, commentsTable, linksTable, activityTable } from "@workspace/db";
import { eq, asc, desc, inArray, sql } from "drizzle-orm";
import { CreateCardBody, UpdateCardBody, MoveCardBody, ListCardsQueryParams } from "@workspace/api-zod";

const router = Router();

async function buildCardResponse(card: typeof cardsTable.$inferSelect) {
  const labels = await db
    .select({ id: labelsTable.id, name: labelsTable.name, color: labelsTable.color, createdAt: labelsTable.createdAt })
    .from(cardLabelsTable)
    .innerJoin(labelsTable, eq(cardLabelsTable.labelId, labelsTable.id))
    .where(eq(cardLabelsTable.cardId, card.id));

  const checklistItems = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.cardId, card.id));
  const checklistTotal = checklistItems.length;
  const checklistDone = checklistItems.filter((i) => i.done).length;

  const comments = await db.select().from(commentsTable).where(eq(commentsTable.cardId, card.id));
  const commentCount = comments.length;

  const [latestNote] = await db.select().from(notesTable)
    .where(eq(notesTable.cardId, card.id))
    .orderBy(desc(notesTable.createdAt))
    .limit(1);

  return {
    ...card,
    labels,
    checklistTotal,
    checklistDone,
    commentCount,
    latestNote: latestNote?.content ?? null,
  };
}

router.get("/cards", async (req, res) => {
  const params = ListCardsQueryParams.parse(req.query);
  let conditions = [];
  if (params.teamId) conditions.push(eq(cardsTable.teamId, params.teamId));
  if (params.assigneeId) conditions.push(eq(cardsTable.assigneeId, params.assigneeId));
  if (params.status) conditions.push(eq(cardsTable.status, params.status));
  if (params.priority) conditions.push(eq(cardsTable.priority, params.priority));

  let rawCards;
  if (conditions.length > 0) {
    rawCards = await db.select().from(cardsTable)
      .where(conditions.length === 1 ? conditions[0] : sql`${conditions.map(c => sql`(${c})`).reduce((a, b) => sql`${a} AND ${b}`)}`)
      .orderBy(asc(cardsTable.position), asc(cardsTable.id));
  } else {
    rawCards = await db.select().from(cardsTable).orderBy(asc(cardsTable.position), asc(cardsTable.id));
  }

  if (params.labelId) {
    const labelCardIds = await db.select({ cardId: cardLabelsTable.cardId })
      .from(cardLabelsTable)
      .where(eq(cardLabelsTable.labelId, params.labelId));
    const ids = labelCardIds.map((r) => r.cardId);
    rawCards = rawCards.filter((c) => ids.includes(c.id));
  }

  const cards = await Promise.all(rawCards.map(buildCardResponse));
  res.json(cards);
});

router.post("/cards", async (req, res) => {
  const body = CreateCardBody.parse(req.body);
  const [card] = await db.insert(cardsTable).values({
    teamId: body.teamId,
    assigneeId: body.assigneeId ?? null,
    title: body.title,
    description: body.description ?? null,
    status: body.status,
    priority: body.priority,
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
    position: body.position ?? 0,
  }).returning();

  await db.insert(activityTable).values({
    eventType: "card_created",
    entityType: "card",
    entityId: card.id,
    description: `Card "${card.title}" created`,
    actorName: "System",
    teamId: card.teamId,
    cardId: card.id,
  });

  const result = await buildCardResponse(card);
  res.status(201).json(result);
});

router.get("/cards/:cardId", async (req, res) => {
  const id = parseInt(req.params.cardId);
  const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, id));
  if (!card) return res.status(404).json({ error: "Card not found" });

  const labels = await db
    .select({ id: labelsTable.id, name: labelsTable.name, color: labelsTable.color, createdAt: labelsTable.createdAt })
    .from(cardLabelsTable)
    .innerJoin(labelsTable, eq(cardLabelsTable.labelId, labelsTable.id))
    .where(eq(cardLabelsTable.cardId, id));

  const notes = await db.select().from(notesTable).where(eq(notesTable.cardId, id)).orderBy(desc(notesTable.createdAt));
  const checklist = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.cardId, id)).orderBy(asc(checklistItemsTable.position));
  const comments = await db.select().from(commentsTable).where(eq(commentsTable.cardId, id)).orderBy(asc(commentsTable.createdAt));
  const links = await db.select().from(linksTable).where(eq(linksTable.cardId, id)).orderBy(asc(linksTable.id));

  res.json({
    ...card,
    labels,
    checklistTotal: checklist.length,
    checklistDone: checklist.filter((i) => i.done).length,
    commentCount: comments.length,
    latestNote: notes[0]?.content ?? null,
    notes,
    checklist,
    comments,
    links,
  });
});

router.put("/cards/:cardId", async (req, res) => {
  const id = parseInt(req.params.cardId);
  const body = UpdateCardBody.parse(req.body);
  const [card] = await db.update(cardsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(cardsTable.id, id))
    .returning();
  if (!card) return res.status(404).json({ error: "Card not found" });

  await db.insert(activityTable).values({
    eventType: "card_updated",
    entityType: "card",
    entityId: card.id,
    description: `Card "${card.title}" updated`,
    actorName: "System",
    teamId: card.teamId,
    cardId: card.id,
  }).catch(() => {});

  const result = await buildCardResponse(card);
  res.json(result);
});

router.delete("/cards/:cardId", async (req, res) => {
  const id = parseInt(req.params.cardId);
  await db.delete(cardsTable).where(eq(cardsTable.id, id));
  res.status(204).send();
});

router.patch("/cards/:cardId/archive", async (req, res) => {
  const id = parseInt(req.params.cardId);
  const { archived } = req.body as { archived: boolean };
  const [card] = await db.update(cardsTable)
    .set({ archived: !!archived, updatedAt: new Date() })
    .where(eq(cardsTable.id, id))
    .returning();
  if (!card) return res.status(404).json({ error: "Card not found" });
  const result = await buildCardResponse(card);
  res.json(result);
});

router.post("/cards/:cardId/move", async (req, res) => {
  const id = parseInt(req.params.cardId);
  const body = MoveCardBody.parse(req.body);
  const [card] = await db.update(cardsTable)
    .set({
      assigneeId: body.assigneeId !== undefined ? body.assigneeId : undefined,
      teamId: body.teamId !== undefined ? body.teamId : undefined,
      position: body.position,
      updatedAt: new Date(),
    })
    .where(eq(cardsTable.id, id))
    .returning();
  if (!card) return res.status(404).json({ error: "Card not found" });
  const result = await buildCardResponse(card);
  res.json(result);
});

router.post("/cards/:cardId/labels", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const { labelId } = req.body;
  await db.insert(cardLabelsTable).values({ cardId, labelId }).onConflictDoNothing();
  res.status(204).send();
});

router.delete("/cards/:cardId/labels/:labelId", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const labelId = parseInt(req.params.labelId);
  await db.delete(cardLabelsTable)
    .where(sql`${cardLabelsTable.cardId} = ${cardId} AND ${cardLabelsTable.labelId} = ${labelId}`);
  res.status(204).send();
});

export default router;
