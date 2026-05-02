import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTeamBody, UpdateTeamBody } from "@workspace/api-zod";

const router = Router();

router.get("/teams", async (req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  res.json(teams);
});

router.post("/teams", async (req, res) => {
  const body = CreateTeamBody.parse(req.body);
  const [team] = await db.insert(teamsTable).values(body).returning();
  res.status(201).json(team);
});

router.get("/teams/:teamId", async (req, res) => {
  const id = parseInt(req.params.teamId);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team);
});

router.put("/teams/:teamId", async (req, res) => {
  const id = parseInt(req.params.teamId);
  const body = UpdateTeamBody.parse(req.body);
  const [team] = await db.update(teamsTable).set(body).where(eq(teamsTable.id, id)).returning();
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team);
});

router.delete("/teams/:teamId", async (req, res) => {
  const id = parseInt(req.params.teamId);
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

export default router;
