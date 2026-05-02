import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, teamsTable, membersTable, activityTable } from "@workspace/db";
import { eq, sql, desc, and, lt } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  const now = new Date().toISOString().split("T")[0];
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(cardsTable);
  const [inProgressResult] = await db.select({ count: sql<number>`count(*)::int` }).from(cardsTable).where(eq(cardsTable.status, "in_progress"));
  const [blockedResult] = await db.select({ count: sql<number>`count(*)::int` }).from(cardsTable).where(eq(cardsTable.status, "blocked"));
  const [doneResult] = await db.select({ count: sql<number>`count(*)::int` }).from(cardsTable).where(eq(cardsTable.status, "done"));
  const [overdueResult] = await db.select({ count: sql<number>`count(*)::int` }).from(cardsTable)
    .where(sql`due_date < ${now} AND status != 'done'`);
  const [dueThisWeekResult] = await db.select({ count: sql<number>`count(*)::int` }).from(cardsTable)
    .where(sql`due_date >= ${now} AND due_date <= ${weekEnd} AND status != 'done'`);
  const [totalTeamsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(teamsTable);
  const [totalMembersResult] = await db.select({ count: sql<number>`count(*)::int` }).from(membersTable);

  res.json({
    totalCards: totalResult.count,
    inProgress: inProgressResult.count,
    blocked: blockedResult.count,
    done: doneResult.count,
    overdue: overdueResult.count,
    dueThisWeek: dueThisWeekResult.count,
    totalTeams: totalTeamsResult.count,
    totalMembers: totalMembersResult.count,
  });
});

router.get("/dashboard/team-summaries", async (req, res) => {
  const now = new Date().toISOString().split("T")[0];
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  const members = await db.select().from(membersTable).orderBy(membersTable.position);
  const cards = await db.select().from(cardsTable);

  const summaries = teams.map((team) => {
    const teamCards = cards.filter((c) => c.teamId === team.id);
    const teamMembers = members.filter((m) => m.teamId === team.id);

    const memberSummaries = teamMembers.map((member) => {
      const memberCards = teamCards.filter((c) => c.assigneeId === member.id);
      const done = memberCards.filter((c) => c.status === "done").length;
      const overdue = memberCards.filter((c) => c.dueDate && c.dueDate < now && c.status !== "done").length;
      return {
        memberId: member.id,
        memberName: member.name,
        cardCount: memberCards.length,
        done,
        overdue,
        aiSummary: null as string | null,
      };
    });

    return {
      teamId: team.id,
      teamName: team.name,
      teamSlug: team.slug,
      teamColor: team.color,
      totalCards: teamCards.length,
      notStarted: teamCards.filter((c) => c.status === "not_started").length,
      inProgress: teamCards.filter((c) => c.status === "in_progress").length,
      blocked: teamCards.filter((c) => c.status === "blocked").length,
      inReview: teamCards.filter((c) => c.status === "in_review").length,
      done: teamCards.filter((c) => c.status === "done").length,
      overdue: teamCards.filter((c) => c.dueDate && c.dueDate < now && c.status !== "done").length,
      members: memberSummaries,
    };
  });

  res.json(summaries);
});

router.get("/dashboard/recent-activity", async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const activity = await db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(limit);
  res.json(activity);
});

export default router;
