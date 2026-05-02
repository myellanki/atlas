import { Router } from "express";
import { db } from "@workspace/db";
import { checklistItemsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateChecklistItemBody, UpdateChecklistItemBody } from "@workspace/api-zod";

const router = Router();

router.get("/cards/:cardId/checklist", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const items = await db.select().from(checklistItemsTable)
    .where(eq(checklistItemsTable.cardId, cardId))
    .orderBy(asc(checklistItemsTable.position), asc(checklistItemsTable.id));
  res.json(items);
});

router.post("/cards/:cardId/checklist", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const body = CreateChecklistItemBody.parse(req.body);
  const [item] = await db.insert(checklistItemsTable).values({ ...body, cardId }).returning();
  res.status(201).json(item);
});

router.put("/checklist/:itemId", async (req, res) => {
  const id = parseInt(req.params.itemId);
  const body = UpdateChecklistItemBody.parse(req.body);
  const [item] = await db.update(checklistItemsTable).set(body).where(eq(checklistItemsTable.id, id)).returning();
  if (!item) return res.status(404).json({ error: "Checklist item not found" });
  res.json(item);
});

router.delete("/checklist/:itemId", async (req, res) => {
  const id = parseInt(req.params.itemId);
  await db.delete(checklistItemsTable).where(eq(checklistItemsTable.id, id));
  res.status(204).send();
});

export default router;
