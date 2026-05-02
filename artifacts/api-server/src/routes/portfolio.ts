import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, membersTable, teamsTable } from "@workspace/db";
import { eq, and, isNotNull, ne } from "drizzle-orm";

const router = Router();

// ── Cross-team utilization data ───────────────────────────────────────────────
// Returns all analysts with their cards across all teams, for portfolio timeline
router.get("/portfolio/utilization", async (req, res) => {
  const members = await db.select().from(membersTable).orderBy(membersTable.name);
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.name);

  const cards = await db
    .select({
      id: cardsTable.id,
      title: cardsTable.title,
      status: cardsTable.status,
      priority: cardsTable.priority,
      startDate: cardsTable.startDate,
      dueDate: cardsTable.dueDate,
      assigneeId: cardsTable.assigneeId,
      teamId: cardsTable.teamId,
    })
    .from(cardsTable)
    .where(isNotNull(cardsTable.assigneeId));

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const analysts = members.map(member => {
    const memberCards = cards.filter(c => c.assigneeId === member.id);
    return {
      memberId: member.id,
      memberName: member.name,
      role: member.role,
      teamId: member.teamId,
      teamName: teamMap[member.teamId]?.name ?? "",
      teamColor: teamMap[member.teamId]?.color ?? "#94a3b8",
      cards: memberCards.map(c => ({
        ...c,
        teamName: teamMap[c.teamId]?.name ?? "",
        teamColor: teamMap[c.teamId]?.color ?? "#94a3b8",
      })),
    };
  });

  res.json({ analysts, teams });
});

// ── Capacity / workload heat data ─────────────────────────────────────────────
// Returns per-analyst weekly workload for the next N weeks
router.get("/portfolio/capacity", async (req, res) => {
  const weeks = Math.min(parseInt(String(req.query.weeks ?? "16")), 52);

  const members = await db.select().from(membersTable).orderBy(membersTable.name);
  const teams = await db.select().from(teamsTable);
  const cards = await db
    .select({
      id: cardsTable.id,
      title: cardsTable.title,
      status: cardsTable.status,
      startDate: cardsTable.startDate,
      dueDate: cardsTable.dueDate,
      assigneeId: cardsTable.assigneeId,
      teamId: cardsTable.teamId,
    })
    .from(cardsTable)
    .where(and(isNotNull(cardsTable.assigneeId), ne(cardsTable.status, "done")));

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  // Build week buckets
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday of current week

  const weekBuckets: { start: Date; end: Date; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const start = new Date(monday);
    start.setDate(monday.getDate() + w * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const yr = start.getFullYear();
    const mo = String(start.getMonth() + 1).padStart(2, "0");
    const dy = String(start.getDate()).padStart(2, "0");
    weekBuckets.push({ start, end, label: `${yr}-${mo}-${dy}` });
  }

  const analystCapacity = members.map(member => {
    const memberCards = cards.filter(c => c.assigneeId === member.id);

    const weeklyLoad = weekBuckets.map(({ start, end, label }) => {
      // Count cards that are active during this week (startDate..dueDate overlaps with week)
      const active = memberCards.filter(c => {
        const cardStart = c.startDate ? new Date(c.startDate) : null;
        const cardEnd = c.dueDate ? new Date(c.dueDate) : null;
        if (!cardEnd) return false;
        if (cardEnd < start) return false;
        if (cardStart && cardStart > end) return false;
        return true;
      });
      return { week: label, count: active.length, cards: active.map(c => ({ id: c.id, title: c.title, teamId: c.teamId, teamColor: teamMap[c.teamId]?.color ?? "#94a3b8", teamName: teamMap[c.teamId]?.name ?? "" })) };
    });

    return {
      memberId: member.id,
      memberName: member.name,
      teamId: member.teamId,
      teamName: teamMap[member.teamId]?.name ?? "",
      teamColor: teamMap[member.teamId]?.color ?? "#94a3b8",
      weeklyLoad,
    };
  });

  res.json({ weeks: weekBuckets.map(w => w.label), analysts: analystCapacity });
});

export default router;
