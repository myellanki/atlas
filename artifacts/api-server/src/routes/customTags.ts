import { Router } from "express";
import { db } from "@workspace/db";
import { customTagsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

// Default seed data
const DEFAULT_DATA_SOURCES = [
  "CDW", "VINCI", "TriNetX", "Cancer Registry", "Survey",
  "VA Benefits", "External Cohort", "Other",
];
const DEFAULT_COHORTS = [
  "Vietnam Veterans", "Gulf War", "Post-9/11 OEF/OIF", "WWII", "Korea",
  "General VA", "Bladder Cancer", "Prostate Cancer", "Lung Cancer",
  "Colorectal Cancer", "Breast Cancer", "Melanoma", "Other",
];

async function seedIfEmpty(category: "data_source" | "cohort") {
  const existing = await db
    .select({ id: customTagsTable.id })
    .from(customTagsTable)
    .where(eq(customTagsTable.category, category))
    .limit(1);
  if (existing.length > 0) return;
  const defaults = category === "data_source" ? DEFAULT_DATA_SOURCES : DEFAULT_COHORTS;
  await db.insert(customTagsTable).values(
    defaults.map((name, i) => ({ category, name, position: i }))
  );
}

router.get("/tags", async (req, res) => {
  const category = req.query.category as string | undefined;
  if (category === "data_source" || category === "cohort") {
    await seedIfEmpty(category);
    const tags = await db
      .select()
      .from(customTagsTable)
      .where(eq(customTagsTable.category, category))
      .orderBy(asc(customTagsTable.position), asc(customTagsTable.name));
    return res.json(tags);
  }
  // Return all tags grouped
  await seedIfEmpty("data_source");
  await seedIfEmpty("cohort");
  const tags = await db
    .select()
    .from(customTagsTable)
    .orderBy(asc(customTagsTable.category), asc(customTagsTable.position), asc(customTagsTable.name));
  res.json(tags);
});

router.post("/tags", async (req, res) => {
  const { category, name, color, position } = req.body as {
    category: "data_source" | "cohort"; name: string; color?: string; position?: number;
  };
  if (!category || !name) return res.status(400).json({ error: "category and name required" });

  // Auto-assign position at end if not provided
  let pos = position;
  if (pos === undefined) {
    const existing = await db
      .select({ position: customTagsTable.position })
      .from(customTagsTable)
      .where(eq(customTagsTable.category, category))
      .orderBy(asc(customTagsTable.position));
    pos = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;
  }

  const [tag] = await db
    .insert(customTagsTable)
    .values({ category, name, color: color ?? null, position: pos })
    .returning();
  res.status(201).json(tag);
});

router.patch("/tags/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, color, position } = req.body as {
    name?: string; color?: string | null; position?: number;
  };
  const [tag] = await db
    .update(customTagsTable)
    .set({
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(position !== undefined && { position }),
    })
    .where(eq(customTagsTable.id, id))
    .returning();
  if (!tag) return res.status(404).json({ error: "Tag not found" });
  res.json(tag);
});

router.delete("/tags/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(customTagsTable).where(eq(customTagsTable.id, id));
  res.status(204).send();
});

export default router;
