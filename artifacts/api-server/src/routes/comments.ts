import { Router } from "express";
import { db } from "@workspace/db";
import { commentsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateCommentBody } from "@workspace/api-zod";

const router = Router();

router.get("/cards/:cardId/comments", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const comments = await db.select().from(commentsTable)
    .where(eq(commentsTable.cardId, cardId))
    .orderBy(asc(commentsTable.createdAt));
  res.json(comments);
});

router.post("/cards/:cardId/comments", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const body = CreateCommentBody.parse(req.body);
  const [comment] = await db.insert(commentsTable).values({ ...body, cardId }).returning();
  res.status(201).json(comment);
});

router.put("/comments/:commentId", async (req, res) => {
  const id = parseInt(req.params.commentId);
  const body = CreateCommentBody.parse(req.body);
  const [comment] = await db.update(commentsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(commentsTable.id, id))
    .returning();
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  res.json(comment);
});

router.delete("/comments/:commentId", async (req, res) => {
  const id = parseInt(req.params.commentId);
  await db.delete(commentsTable).where(eq(commentsTable.id, id));
  res.status(204).send();
});

export default router;
