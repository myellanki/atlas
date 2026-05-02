import { pgTable, serial, integer, varchar, text, date, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { cardsTable } from "./cards";

export const deliverablesTable = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cardsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("paper"),
  targetDate: date("target_date"),
  status: varchar("status", { length: 50 }).notNull().default("drafting"),
  journal: varchar("journal", { length: 255 }),
  firstAuthor: varchar("first_author", { length: 255 }),
  doi: varchar("doi", { length: 255 }),
  url: text("url"),
  notes: text("notes"),
  publishedYear: integer("published_year"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Deliverable = typeof deliverablesTable.$inferSelect;

export const CreateDeliverableBody = z.object({
  title: z.string().min(1).max(500),
  type: z.enum(["paper", "report", "conference", "product"]).optional(),
  targetDate: z.string().nullable().optional(),
  status: z.enum(["drafting", "submitted", "accepted", "published"]).optional(),
  journal: z.string().nullable().optional(),
  firstAuthor: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  publishedYear: z.number().int().nullable().optional(),
});

export const UpdateDeliverableBody = CreateDeliverableBody.partial();
