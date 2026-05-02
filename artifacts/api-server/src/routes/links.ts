import { Router } from "express";
import { db } from "@workspace/db";
import { linksTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateLinkBody } from "@workspace/api-zod";

const router = Router();

router.get("/cards/:cardId/links", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const links = await db.select().from(linksTable)
    .where(eq(linksTable.cardId, cardId))
    .orderBy(asc(linksTable.id));
  res.json(links);
});

router.post("/cards/:cardId/links", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const body = CreateLinkBody.parse(req.body);
  const [link] = await db.insert(linksTable).values({ ...body, cardId }).returning();
  res.status(201).json(link);
});

router.delete("/links/:linkId", async (req, res) => {
  const id = parseInt(req.params.linkId);
  await db.delete(linksTable).where(eq(linksTable.id, id));
  res.status(204).send();
});

export default router;
