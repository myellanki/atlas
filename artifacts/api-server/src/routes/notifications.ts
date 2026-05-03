import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/notifications", async (_req, res) => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/notifications", async (req, res) => {
  const { type, title, message, cardId, irbSubmissionId } = req.body as Record<string, unknown>;
  if (!title) return res.status(400).json({ error: "title required" });
  const [n] = await db
    .insert(notificationsTable)
    .values({
      type: (type as string) || "info",
      title: (title as string).trim(),
      message: message ? (message as string).trim() : null,
      cardId: cardId ? Number(cardId) : null,
      irbSubmissionId: irbSubmissionId ? Number(irbSubmissionId) : null,
    })
    .returning();
  res.status(201).json(n);
});

router.patch("/notifications/:id/read", async (req, res) => {
  const id = parseInt(req.params.id);
  const [n] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!n) return res.status(404).json({ error: "Not found" });
  res.json(n);
});

router.post("/notifications/read-all", async (_req, res) => {
  await db.update(notificationsTable).set({ read: true });
  res.json({ ok: true });
});

router.delete("/notifications/:id", async (req, res) => {
  await db.delete(notificationsTable).where(eq(notificationsTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

export default router;
