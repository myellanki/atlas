import { Router } from "express";
import { db } from "@workspace/db";
import { cardTemplatesTable, cardTemplateItemsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

const DEFAULT_TEMPLATES = [
  {
    name: "New Research Study",
    description: "Full lifecycle for a new VA clinical research project from conception to dissemination.",
    color: "#8b5cf6",
    icon: "Beaker",
    items: [
      "Define research question and specific aims",
      "Literature review and gap analysis",
      "Draft study protocol",
      "Submit IRB application",
      "Obtain IRB approval",
      "Data access request (CDW / VINCI / TriNetX)",
      "Data access approved",
      "Data extraction and validation",
      "Exploratory data analysis (EDA)",
      "Statistical analysis plan (SAP)",
      "Run primary analyses",
      "Draft manuscript",
      "Internal review and revisions",
      "Submit to target journal",
      "Address peer review comments",
      "Manuscript accepted",
      "Dissemination (conference / brief / operations brief)",
    ],
  },
  {
    name: "Data Pipeline Build",
    description: "Standard steps for building a new data extraction, transformation, and loading pipeline.",
    color: "#0ea5e9",
    icon: "GitBranch",
    items: [
      "Define data requirements and sources",
      "Request data access (VA CDW / VINCI)",
      "Schema discovery and documentation",
      "Draft extraction query (SQL / SAS)",
      "Data quality assessment (nulls, ranges, duplicates)",
      "Cohort definition and inclusion/exclusion criteria",
      "Variable derivation and calculated fields",
      "De-identification / PHI removal check",
      "Pipeline unit tests",
      "Generate data dictionary",
      "Peer code review",
      "Final dataset locked and versioned",
      "Analytic file delivered to team",
    ],
  },
  {
    name: "App Feature Sprint",
    description: "Agile sprint checklist for building and deploying a new application feature.",
    color: "#10b981",
    icon: "Zap",
    items: [
      "Requirements gathering and stakeholder sign-off",
      "Technical design / architecture review",
      "Create feature branch",
      "Backend API implementation",
      "Frontend UI implementation",
      "Unit and integration tests",
      "Internal UAT (user acceptance testing)",
      "Accessibility and security review",
      "Documentation updated",
      "Code review approved",
      "Merge to main / deploy to staging",
      "Stakeholder demo and sign-off",
      "Deploy to production",
      "Post-deploy monitoring (24–48h)",
    ],
  },
  {
    name: "Manuscript Preparation",
    description: "Focused checklist for taking analysis results through to a published paper.",
    color: "#f59e0b",
    icon: "FileText",
    items: [
      "Finalize analysis results (tables, figures)",
      "Select target journal and review submission guidelines",
      "Draft Introduction",
      "Draft Methods",
      "Draft Results",
      "Draft Discussion and Conclusion",
      "Compile references (EndNote / Zotero)",
      "Author list finalized and contributions documented",
      "Co-author review round 1",
      "Address co-author comments",
      "VA Public Affairs / Operations review (if required)",
      "Final proofreading",
      "Format per journal guidelines",
      "Submit via journal portal",
      "Acknowledge receipt / tracking number",
    ],
  },
];

async function seedIfEmpty() {
  const existing = await db
    .select({ id: cardTemplatesTable.id })
    .from(cardTemplatesTable)
    .limit(1);
  if (existing.length > 0) return;

  for (let i = 0; i < DEFAULT_TEMPLATES.length; i++) {
    const t = DEFAULT_TEMPLATES[i];
    const [tpl] = await db
      .insert(cardTemplatesTable)
      .values({ name: t.name, description: t.description, color: t.color, icon: t.icon, position: i })
      .returning();
    await db.insert(cardTemplateItemsTable).values(
      t.items.map((text, pos) => ({ templateId: tpl.id, text, position: pos }))
    );
  }
}

async function getTemplatesWithItems() {
  const templates = await db
    .select()
    .from(cardTemplatesTable)
    .orderBy(asc(cardTemplatesTable.position), asc(cardTemplatesTable.id));

  const items = await db
    .select()
    .from(cardTemplateItemsTable)
    .orderBy(asc(cardTemplateItemsTable.position));

  return templates.map(t => ({
    ...t,
    items: items.filter(i => i.templateId === t.id),
  }));
}

// GET /api/templates
router.get("/templates", async (req, res) => {
  await seedIfEmpty();
  const templates = await getTemplatesWithItems();
  res.json(templates);
});

// POST /api/templates  — create with items
router.post("/templates", async (req, res) => {
  const { name, description, color, icon, items = [] } = req.body as {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    items?: string[];
  };
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  // put new templates at end
  const existing = await db.select({ position: cardTemplatesTable.position }).from(cardTemplatesTable).orderBy(asc(cardTemplatesTable.position));
  const position = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;

  const [tpl] = await db.insert(cardTemplatesTable).values({
    name: name.trim(),
    description: description?.trim() || null,
    color: color || "#8b5cf6",
    icon: icon || "ClipboardList",
    position,
  }).returning();

  if (items.length > 0) {
    await db.insert(cardTemplateItemsTable).values(
      items.map((text, pos) => ({ templateId: tpl.id, text: text.trim(), position: pos }))
    );
  }

  const result = await getTemplatesWithItems();
  const created = result.find(t => t.id === tpl.id);
  res.status(201).json(created);
});

// PATCH /api/templates/:id  — update metadata + replace items
router.patch("/templates/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, color, icon, items } = req.body as {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    items?: string[];
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (color !== undefined) updates.color = color;
  if (icon !== undefined) updates.icon = icon;

  if (Object.keys(updates).length > 0) {
    await db.update(cardTemplatesTable).set(updates).where(eq(cardTemplatesTable.id, id));
  }

  // Replace items if provided
  if (Array.isArray(items)) {
    await db.delete(cardTemplateItemsTable).where(eq(cardTemplateItemsTable.templateId, id));
    if (items.length > 0) {
      await db.insert(cardTemplateItemsTable).values(
        items.map((text, pos) => ({ templateId: id, text: text.trim(), position: pos }))
      );
    }
  }

  const result = await getTemplatesWithItems();
  const updated = result.find(t => t.id === id);
  if (!updated) return res.status(404).json({ error: "Template not found" });
  res.json(updated);
});

// DELETE /api/templates/:id
router.delete("/templates/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  // items cascade-deleted by FK
  await db.delete(cardTemplatesTable).where(eq(cardTemplatesTable.id, id));
  res.status(204).send();
});

export default router;
