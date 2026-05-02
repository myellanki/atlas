import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, membersTable, notesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

// ── OpenAI client (Replit AI proxy) ────────────────────────────────────────
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// ── Fallback summary (no AI) ────────────────────────────────────────────────
function generateSimpleSummary(notes: { content: string }[], cardTitles: string[], dueDate?: string | null): string {
  if (notes.length === 0 && cardTitles.length === 0) return "No active work items";
  const latestNote = notes[0]?.content ?? "";
  const snippet = latestNote.length > 60 ? latestNote.slice(0, 57) + "..." : latestNote;
  if (snippet) return snippet;
  return `${cardTitles.length} task${cardTitles.length !== 1 ? "s" : ""} in progress`;
}

// ── Team column summary ─────────────────────────────────────────────────────
router.post("/ai/team-column-summary", async (req, res) => {
  const { teamId } = req.body;
  if (!teamId) return res.status(400).json({ error: "teamId required" });

  const members = await db.select().from(membersTable).where(eq(membersTable.teamId, teamId)).orderBy(membersTable.position);
  const now = new Date().toISOString().split("T")[0];

  const summaries = await Promise.all(
    members.map(async (member) => {
      const cards = await db.select().from(cardsTable).where(eq(cardsTable.assigneeId, member.id));
      const activeCards = cards.filter((c) => c.status !== "done");

      const allNotes = await Promise.all(
        activeCards.map((c) =>
          db.select().from(notesTable).where(eq(notesTable.cardId, c.id)).orderBy(desc(notesTable.createdAt)).limit(1)
        )
      );
      const latestNotes = allNotes.flat();

      const upcomingCards = activeCards
        .filter((c) => c.dueDate && c.dueDate >= now)
        .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

      const summary = generateSimpleSummary(
        latestNotes,
        activeCards.map((c) => c.title),
        upcomingCards[0]?.dueDate
      );

      return {
        memberId: member.id,
        memberName: member.name,
        summary,
        upcomingDeadline: upcomingCards[0]?.dueDate ?? null,
      };
    })
  );

  res.json(summaries);
});

// ── Single card AI summary ──────────────────────────────────────────────────
router.post("/ai/card-summary", async (req, res) => {
  const { cardId } = req.body;
  if (!cardId) return res.status(400).json({ error: "cardId required" });

  const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, cardId));
  if (!card) return res.status(404).json({ error: "Card not found" });

  const notes = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.cardId, cardId))
    .orderBy(desc(notesTable.createdAt))
    .limit(3);

  const noteText = notes.map((n) => n.content).join(" | ");
  const statusLabel = card.status.replace(/_/g, " ");

  let summary: string;

  try {
    const prompt = [
      `Project: "${card.title}"`,
      `Status: ${statusLabel} | Priority: ${card.priority}`,
      card.dueDate ? `Due: ${card.dueDate}` : null,
      noteText ? `Latest updates: ${noteText}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a concise project status summarizer for a data science team. Given project info, write exactly ONE sentence of 8–12 words capturing the current state or key blocker. Be specific — use concrete details from the notes. No fluff, no filler. Output ONLY the sentence, no punctuation at start/end beyond a period.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 60,
      temperature: 0.3,
    });

    summary = response.choices[0]?.message?.content?.trim() ?? "";
    if (!summary) throw new Error("Empty response");
  } catch {
    // Fallback: truncate latest note
    const latestNote = notes[0]?.content ?? "";
    summary = latestNote.length > 80
      ? latestNote.slice(0, 77) + "…"
      : latestNote || `${statusLabel} — ${card.priority} priority`;
  }

  res.json({ cardId, summary });
});

// ── Batch card summaries ────────────────────────────────────────────────────
router.post("/ai/batch-card-summaries", async (req, res) => {
  const { cardIds } = req.body as { cardIds?: number[] };
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return res.status(400).json({ error: "cardIds array required" });
  }
  if (cardIds.length > 50) {
    return res.status(400).json({ error: "Max 50 cards per batch" });
  }

  // Set up SSE so the client can stream results as they arrive
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Process cards concurrently in groups of 5 to respect rate limits
  const CONCURRENCY = 5;
  for (let i = 0; i < cardIds.length; i += CONCURRENCY) {
    const chunk = cardIds.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (cardId) => {
        try {
          const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, cardId));
          if (!card) { send({ cardId, error: "not found" }); return; }

          const notes = await db
            .select()
            .from(notesTable)
            .where(eq(notesTable.cardId, cardId))
            .orderBy(desc(notesTable.createdAt))
            .limit(3);

          const noteText = notes.map((n) => n.content).join(" | ");
          const statusLabel = card.status.replace(/_/g, " ");

          const prompt = [
            `Project: "${card.title}"`,
            `Status: ${statusLabel} | Priority: ${card.priority}`,
            card.dueDate ? `Due: ${card.dueDate}` : null,
            noteText ? `Latest updates: ${noteText}` : null,
          ].filter(Boolean).join("\n");

          const response = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a concise project status summarizer for a data science team. Given project info, write exactly ONE sentence of 8–12 words capturing the current state or key blocker. Be specific — use concrete details from the notes. No fluff, no filler. Output ONLY the sentence, no punctuation at start/end beyond a period.",
              },
              { role: "user", content: prompt },
            ],
            max_tokens: 60,
            temperature: 0.3,
          });

          const summary = response.choices[0]?.message?.content?.trim()
            ?? (noteText.length > 80 ? noteText.slice(0, 77) + "…" : noteText || `${statusLabel} — ${card.priority} priority`);

          send({ cardId, summary });
        } catch {
          send({ cardId, error: "generation failed" });
        }
      })
    );
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

export default router;
