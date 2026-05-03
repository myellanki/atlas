import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, teamsTable, membersTable, irbSubmissionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/reports/summary", async (_req, res) => {
  const now = new Date().toISOString().split("T")[0];
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [cards, teams, members, irbRecords] = await Promise.all([
    db.select().from(cardsTable).orderBy(desc(cardsTable.createdAt)),
    db.select().from(teamsTable),
    db.select().from(membersTable),
    db.select().from(irbSubmissionsTable).orderBy(desc(irbSubmissionsTable.createdAt)),
  ]);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  const cardRows = cards.map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    priority: c.priority,
    team: c.teamId ? teamMap[c.teamId]?.name ?? "" : "",
    assignee: c.assigneeId ? memberMap[c.assigneeId]?.name ?? "" : "",
    dueDate: c.dueDate ?? "",
    isOverdue: !!(c.dueDate && c.dueDate < now && c.status !== "done"),
    dueThisWeek: !!(c.dueDate && c.dueDate >= now && c.dueDate <= weekEnd && c.status !== "done"),
  }));

  const teamSummaries = teams.map(t => {
    const tc = cards.filter(c => c.teamId === t.id);
    return {
      team: t.name,
      total: tc.length,
      notStarted: tc.filter(c => c.status === "not_started").length,
      inProgress: tc.filter(c => c.status === "in_progress").length,
      inReview: tc.filter(c => c.status === "in_review").length,
      blocked: tc.filter(c => c.status === "blocked").length,
      done: tc.filter(c => c.status === "done").length,
      overdue: tc.filter(c => c.dueDate && c.dueDate < now && c.status !== "done").length,
    };
  });

  const irbRows = irbRecords.map(r => ({
    id: r.id,
    protocolNumber: r.protocolNumber ?? "",
    title: r.title,
    pi: r.pi ?? "",
    irbTeamMember: (r as any).irbTeamMember ?? "",
    submissionType: r.submissionType,
    status: r.status,
    priority: (r as any).priority ?? "",
    expirationDate: r.expirationDate ?? "",
    team: r.teamId ? teamMap[r.teamId]?.name ?? "" : "",
  }));

  res.json({
    generatedAt: new Date().toISOString(),
    cards: cardRows,
    teamSummaries,
    irb: irbRows,
    totals: {
      cards: cards.length,
      inProgress: cards.filter(c => c.status === "in_progress").length,
      blocked: cards.filter(c => c.status === "blocked").length,
      done: cards.filter(c => c.status === "done").length,
      overdue: cards.filter(c => c.dueDate && c.dueDate < now && c.status !== "done").length,
      irbTotal: irbRecords.length,
      irbApproved: irbRecords.filter(r => r.status === "approved").length,
      irbExpired: irbRecords.filter(r => r.status === "expired").length,
    },
  });
});

export default router;
