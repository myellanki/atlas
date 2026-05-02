import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, membersTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function toGanttBar(card: typeof cardsTable.$inferSelect, memberName?: string) {
  return {
    cardId: card.id,
    title: card.title,
    startDate: card.startDate ?? null,
    dueDate: card.dueDate ?? null,
    status: card.status,
    priority: card.priority,
    assigneeId: card.assigneeId ?? null,
    assigneeName: memberName ?? null,
  };
}

router.get("/gantt/:teamId", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) return res.status(404).json({ error: "Team not found" });

  const members = await db.select().from(membersTable).where(eq(membersTable.teamId, teamId)).orderBy(membersTable.position);
  const cards = await db.select().from(cardsTable).where(eq(cardsTable.teamId, teamId));
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const memberGantts = members.map((member) => {
    const memberCards = cards.filter((c) => c.assigneeId === member.id);
    return {
      memberId: member.id,
      memberName: member.name,
      bars: memberCards.map((c) => toGanttBar(c, member.name)),
    };
  });

  const allBars = cards.map((c) => toGanttBar(c, c.assigneeId ? memberMap.get(c.assigneeId) : undefined));

  res.json({
    teamId: team.id,
    teamName: team.name,
    members: memberGantts,
    allBars,
  });
});

router.get("/gantt/:teamId/member/:memberId", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const memberId = parseInt(req.params.memberId);
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member) return res.status(404).json({ error: "Member not found" });

  const cards = await db.select().from(cardsTable).where(eq(cardsTable.assigneeId, memberId));

  res.json({
    memberId: member.id,
    memberName: member.name,
    bars: cards.map((c) => toGanttBar(c, member.name)),
  });
});

export default router;
