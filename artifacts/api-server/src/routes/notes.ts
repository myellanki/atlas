import { Router } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateNoteBody } from "@workspace/api-zod";

const router = Router();

router.get("/cards/:cardId/notes", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const notes = await db.select().from(notesTable)
    .where(eq(notesTable.cardId, cardId))
    .orderBy(desc(notesTable.createdAt));
  res.json(notes);
});

router.post("/cards/:cardId/notes", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const body = CreateNoteBody.parse(req.body);
  const [note] = await db.insert(notesTable).values({ ...body, cardId }).returning();
  res.status(201).json(note);
});

router.put("/notes/:noteId", async (req, res) => {
  const id = parseInt(req.params.noteId);
  const body = CreateNoteBody.parse(req.body);
  const [note] = await db.update(notesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(notesTable.id, id))
    .returning();
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
});

router.delete("/notes/:noteId", async (req, res) => {
  const id = parseInt(req.params.noteId);
  await db.delete(notesTable).where(eq(notesTable.id, id));
  res.status(204).send();
});

export default router;
