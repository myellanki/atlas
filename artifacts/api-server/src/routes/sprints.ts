import { Router } from "express";
import { db } from "@workspace/db";
import { sprintsTable, cardsTable, CreateSprintBody, UpdateSprintBody } from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";

const router = Router();

// ── List sprints for a team ─────────────────────────────────────────────────
router.get("/teams/:teamId/sprints", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const sprints = await db
    .select()
    .from(sprintsTable)
    .where(eq(sprintsTable.teamId, teamId))
    .orderBy(sprintsTable.startDate);
  res.json(sprints);
});

// ── Create sprint ───────────────────────────────────────────────────────────
router.post("/teams/:teamId/sprints", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const body = CreateSprintBody.parse(req.body);
  const [sprint] = await db
    .insert(sprintsTable)
    .values({
      teamId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      goal: body.goal ?? null,
      color: body.color ?? "#6366f1",
    })
    .returning();
  res.status(201).json(sprint);
});

// ── Update sprint ───────────────────────────────────────────────────────────
router.patch("/sprints/:sprintId", async (req, res) => {
  const id = parseInt(req.params.sprintId);
  const body = UpdateSprintBody.parse(req.body);
  const [sprint] = await db
    .update(sprintsTable)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.startDate !== undefined && { startDate: body.startDate }),
      ...(body.endDate !== undefined && { endDate: body.endDate }),
      ...(body.goal !== undefined && { goal: body.goal }),
      ...(body.color !== undefined && { color: body.color }),
    })
    .where(eq(sprintsTable.id, id))
    .returning();
  if (!sprint) return res.status(404).json({ error: "Sprint not found" });
  res.json(sprint);
});

// ── Delete sprint ───────────────────────────────────────────────────────────
router.delete("/sprints/:sprintId", async (req, res) => {
  const id = parseInt(req.params.sprintId);
  await db.delete(sprintsTable).where(eq(sprintsTable.id, id));
  res.status(204).send();
});

// ── Burndown data ───────────────────────────────────────────────────────────
// Cards are associated to a sprint by their dueDate falling within the sprint range.
router.get("/sprints/:sprintId/burndown", async (req, res) => {
  const id = parseInt(req.params.sprintId);
  const [sprint] = await db.select().from(sprintsTable).where(eq(sprintsTable.id, id));
  if (!sprint) return res.status(404).json({ error: "Sprint not found" });

  // Cards whose dueDate falls within the sprint window
  const sprintCards = await db
    .select()
    .from(cardsTable)
    .where(
      and(
        eq(cardsTable.teamId, sprint.teamId),
        isNotNull(cardsTable.dueDate),
        gte(cardsTable.dueDate, sprint.startDate),
        lte(cardsTable.dueDate, sprint.endDate)
      )
    );

  const total = sprintCards.length;
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startMs = new Date(sprint.startDate).getTime();
  const endMs = new Date(sprint.endDate).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endMs - startMs) / dayMs) + 1;

  const data: { date: string; remaining: number; ideal: number; isFuture: boolean }[] = [];

  for (let i = 0; i < totalDays; i++) {
    const dayDate = new Date(startMs + i * dayMs);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    const isFuture = dayDate > today;

    const ideal = Math.max(0, total - (total * i) / (totalDays - 1 || 1));

    let remaining: number;
    if (isFuture) {
      // Project flat from current state
      remaining = sprintCards.filter(c => c.status !== "done").length;
    } else {
      // Count cards not yet done as of end of this day
      remaining = sprintCards.filter(c => {
        if (c.status !== "done") return true;
        // Mark as done when updatedAt crossed into done
        return new Date(c.updatedAt).getTime() > dayEnd.getTime();
      }).length;
    }

    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, "0");
    const dd = String(dayDate.getDate()).padStart(2, "0");

    data.push({ date: `${yyyy}-${mm}-${dd}`, remaining, ideal, isFuture });
  }

  const completedCards = sprintCards.filter(c => c.status === "done").length;

  res.json({
    sprintId: sprint.id,
    sprintName: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    goal: sprint.goal,
    color: sprint.color,
    totalCards: total,
    completedCards,
    data,
  });
});

export default router;
