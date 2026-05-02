import { Router } from "express";
import { db } from "@workspace/db";
import { milestonesTable, CreateMilestoneBody, UpdateMilestoneBody } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/teams/:teamId/milestones", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.teamId, teamId))
    .orderBy(milestonesTable.date);
  res.json(milestones);
});

router.get("/milestones", async (req, res) => {
  const milestones = await db
    .select()
    .from(milestonesTable)
    .orderBy(milestonesTable.date);
  res.json(milestones);
});

router.post("/teams/:teamId/milestones", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const body = CreateMilestoneBody.parse(req.body);
  const [milestone] = await db
    .insert(milestonesTable)
    .values({
      teamId,
      name: body.name,
      date: body.date,
      type: body.type ?? "general",
      color: body.color ?? "#f59e0b",
      description: body.description ?? null,
      cardId: body.cardId ?? null,
    })
    .returning();
  res.status(201).json(milestone);
});

router.patch("/milestones/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = UpdateMilestoneBody.parse(req.body);
  const [milestone] = await db
    .update(milestonesTable)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.date !== undefined && { date: body.date }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.cardId !== undefined && { cardId: body.cardId }),
    })
    .where(eq(milestonesTable.id, id))
    .returning();
  if (!milestone) return res.status(404).json({ error: "Milestone not found" });
  res.json(milestone);
});

router.delete("/milestones/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(milestonesTable).where(eq(milestonesTable.id, id));
  res.status(204).send();
});

export default router;
