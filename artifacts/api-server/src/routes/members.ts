import { Router } from "express";
import { db } from "@workspace/db";
import { membersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateMemberBody, UpdateMemberBody, ListMembersQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/members", async (req, res) => {
  const params = ListMembersQueryParams.parse(req.query);
  let query = db.select().from(membersTable).orderBy(asc(membersTable.position), asc(membersTable.id));
  if (params.teamId) {
    const members = await db.select().from(membersTable)
      .where(eq(membersTable.teamId, params.teamId))
      .orderBy(asc(membersTable.position), asc(membersTable.id));
    return res.json(members);
  }
  const members = await query;
  res.json(members);
});

router.post("/members", async (req, res) => {
  const body = CreateMemberBody.parse(req.body);
  const [member] = await db.insert(membersTable).values(body).returning();
  res.status(201).json(member);
});

router.get("/members/:memberId", async (req, res) => {
  const id = parseInt(req.params.memberId);
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) return res.status(404).json({ error: "Member not found" });
  res.json(member);
});

router.put("/members/:memberId", async (req, res) => {
  const id = parseInt(req.params.memberId);
  const body = UpdateMemberBody.parse(req.body);
  const [member] = await db.update(membersTable).set(body).where(eq(membersTable.id, id)).returning();
  if (!member) return res.status(404).json({ error: "Member not found" });
  res.json(member);
});

router.delete("/members/:memberId", async (req, res) => {
  const id = parseInt(req.params.memberId);
  await db.delete(membersTable).where(eq(membersTable.id, id));
  res.status(204).send();
});

export default router;
