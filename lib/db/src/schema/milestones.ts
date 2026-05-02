import { pgTable, serial, integer, varchar, text, date, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { cardsTable } from "./cards";

export const milestonesTable = pgTable("milestones", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  date: date("date").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("general"),
  color: varchar("color", { length: 50 }).notNull().default("#f59e0b"),
  description: text("description"),
  cardId: integer("card_id").references(() => cardsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Milestone = typeof milestonesTable.$inferSelect;

export const CreateMilestoneBody = z.object({
  name: z.string().min(1).max(255),
  date: z.string(),
  type: z.enum(["irb_submission", "data_access", "eda_complete", "manuscript", "dissemination", "general"]).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  cardId: z.number().int().optional(),
});

export const UpdateMilestoneBody = z.object({
  name: z.string().min(1).max(255).optional(),
  date: z.string().optional(),
  type: z.string().optional(),
  color: z.string().optional(),
  description: z.string().nullable().optional(),
  cardId: z.number().int().nullable().optional(),
});
