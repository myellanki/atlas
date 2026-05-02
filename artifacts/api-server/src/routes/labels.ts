import { Router } from "express";
import { db } from "@workspace/db";
import { labelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateLabelBody } from "@workspace/api-zod";

const router = Router();

router.get("/labels", async (req, res) => {
  const labels = await db.select().from(labelsTable).orderBy(labelsTable.id);
  res.json(labels);
});

router.post("/labels", async (req, res) => {
  const body = CreateLabelBody.parse(req.body);
  const [label] = await db.insert(labelsTable).values(body).returning();
  res.status(201).json(label);
});

router.put("/labels/:labelId", async (req, res) => {
  const id = parseInt(req.params.labelId);
  const body = CreateLabelBody.parse(req.body);
  const [label] = await db.update(labelsTable).set(body).where(eq(labelsTable.id, id)).returning();
  if (!label) return res.status(404).json({ error: "Label not found" });
  res.json(label);
});

router.delete("/labels/:labelId", async (req, res) => {
  const id = parseInt(req.params.labelId);
  await db.delete(labelsTable).where(eq(labelsTable.id, id));
  res.status(204).send();
});

export default router;
