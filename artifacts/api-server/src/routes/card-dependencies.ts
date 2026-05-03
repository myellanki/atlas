import { Router } from "express";
import { db } from "@workspace/db";
import { cardDependenciesTable, cardsTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";

const router = Router();

router.get("/cards/:id/dependencies", async (req, res) => {
  const cardId = parseInt(req.params.id);
  const rows = await db
    .select({
      id: cardDependenciesTable.id,
      cardId: cardDependenciesTable.cardId,
      dependsOnCardId: cardDependenciesTable.dependsOnCardId,
      createdAt: cardDependenciesTable.createdAt,
    })
    .from(cardDependenciesTable)
    .where(eq(cardDependenciesTable.cardId, cardId));

  const depCardIds = rows.map(r => r.dependsOnCardId);
  let depCards: { id: number; title: string; status: string; teamId: number | null }[] = [];
  if (depCardIds.length > 0) {
    depCards = await db
      .select({ id: cardsTable.id, title: cardsTable.title, status: cardsTable.status, teamId: cardsTable.teamId })
      .from(cardsTable)
      .where(
        depCardIds.length === 1
          ? eq(cardsTable.id, depCardIds[0])
          : or(...depCardIds.map(id => eq(cardsTable.id, id)))!
      );
  }

  const cardMap = Object.fromEntries(depCards.map(c => [c.id, c]));
  const result = rows.map(r => ({
    ...r,
    dependsOnCard: cardMap[r.dependsOnCardId] ?? null,
  }));
  res.json(result);
});

router.post("/cards/:id/dependencies", async (req, res) => {
  const cardId = parseInt(req.params.id);
  const { dependsOnCardId } = req.body as { dependsOnCardId: number };
  if (!dependsOnCardId || isNaN(dependsOnCardId)) {
    return res.status(400).json({ error: "dependsOnCardId required" });
  }
  if (dependsOnCardId === cardId) {
    return res.status(400).json({ error: "A card cannot depend on itself" });
  }
  const existing = await db
    .select()
    .from(cardDependenciesTable)
    .where(
      and(
        eq(cardDependenciesTable.cardId, cardId),
        eq(cardDependenciesTable.dependsOnCardId, dependsOnCardId)
      )
    );
  if (existing.length > 0) return res.status(409).json({ error: "Dependency already exists" });

  const [dep] = await db
    .insert(cardDependenciesTable)
    .values({ cardId, dependsOnCardId })
    .returning();
  res.status(201).json(dep);
});

router.delete("/cards/:id/dependencies/:depId", async (req, res) => {
  const depId = parseInt(req.params.depId);
  await db.delete(cardDependenciesTable).where(eq(cardDependenciesTable.id, depId));
  res.status(204).send();
});

export default router;
