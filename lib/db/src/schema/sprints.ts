import { pgTable, serial, integer, varchar, text, date, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const sprintsTable = pgTable("sprints", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  goal: text("goal"),
  color: varchar("color", { length: 50 }).notNull().default("#6366f1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Sprint = typeof sprintsTable.$inferSelect;

export const CreateSprintBody = z.object({
  name: z.string().min(1).max(255),
  startDate: z.string(),
  endDate: z.string(),
  goal: z.string().optional(),
  color: z.string().optional(),
});

export const UpdateSprintBody = z.object({
  name: z.string().min(1).max(255).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  goal: z.string().nullable().optional(),
  color: z.string().optional(),
});
