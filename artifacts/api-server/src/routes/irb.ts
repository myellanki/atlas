import { Router } from "express";
import { db } from "@workspace/db";
import { irbSubmissionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/irb", async (_req, res) => {
  const records = await db
    .select()
    .from(irbSubmissionsTable)
    .orderBy(desc(irbSubmissionsTable.createdAt));
  res.json(records);
});

router.post("/irb", async (req, res) => {
  const {
    teamId, protocolNumber, title, pi, piEmail,
    irbTeamMember, irbTeamMemberEmail,
    submissionType, status, priority,
    submittedDate, approvedDate, expirationDate, notes, customLabels,
  } = req.body as Record<string, string>;
  if (!title?.trim()) return res.status(400).json({ error: "title required" });

  const [record] = await db.insert(irbSubmissionsTable).values({
    teamId: teamId ? parseInt(teamId) : null,
    protocolNumber: protocolNumber?.trim() || null,
    title: title.trim(),
    pi: pi?.trim() || null,
    piEmail: piEmail?.trim() || null,
    irbTeamMember: irbTeamMember?.trim() || null,
    irbTeamMemberEmail: irbTeamMemberEmail?.trim() || null,
    submissionType: submissionType || "new_study",
    status: status || "draft",
    priority: priority ? parseInt(priority) as 1|2|3|4|5 : 3,
    customLabels: customLabels || null,
    submittedDate: submittedDate || null,
    approvedDate: approvedDate || null,
    expirationDate: expirationDate || null,
    notes: notes?.trim() || null,
  }).returning();
  res.status(201).json(record);
});

router.patch("/irb/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    teamId, protocolNumber, title, pi, piEmail,
    irbTeamMember, irbTeamMemberEmail,
    submissionType, status, priority,
    submittedDate, approvedDate, expirationDate, notes, customLabels,
  } = req.body as Record<string, string | null>;

  const updates: Record<string, unknown> = {};
  if (teamId !== undefined)               updates.teamId = teamId ? parseInt(teamId as string) : null;
  if (protocolNumber !== undefined)       updates.protocolNumber = (protocolNumber as string)?.trim() || null;
  if (title !== undefined)                updates.title = (title as string).trim();
  if (pi !== undefined)                   updates.pi = (pi as string)?.trim() || null;
  if (piEmail !== undefined)              updates.piEmail = (piEmail as string)?.trim() || null;
  if (irbTeamMember !== undefined)        updates.irbTeamMember = (irbTeamMember as string)?.trim() || null;
  if (irbTeamMemberEmail !== undefined)   updates.irbTeamMemberEmail = (irbTeamMemberEmail as string)?.trim() || null;
  if (submissionType !== undefined)       updates.submissionType = submissionType;
  if (status !== undefined)              updates.status = status;
  if (priority !== undefined)            updates.priority = priority ? parseInt(priority as string) : 3;
  if (customLabels !== undefined)        updates.customLabels = customLabels || null;
  if (submittedDate !== undefined)       updates.submittedDate = submittedDate || null;
  if (approvedDate !== undefined)        updates.approvedDate = approvedDate || null;
  if (expirationDate !== undefined)      updates.expirationDate = expirationDate || null;
  if (notes !== undefined)               updates.notes = (notes as string)?.trim() || null;

  const [record] = await db.update(irbSubmissionsTable).set(updates).where(eq(irbSubmissionsTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

router.delete("/irb/:id", async (req, res) => {
  await db.delete(irbSubmissionsTable).where(eq(irbSubmissionsTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

export default router;
