import { pgTable, serial, integer, varchar, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { membersTable } from "./members";
import { labelsTable } from "./labels";

export const cardsTable = pgTable("cards", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  assigneeId: integer("assignee_id").references(() => membersTable.id, { onDelete: "set null" }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("not_started"),
  priority: varchar("priority", { length: 50 }).notNull().default("medium"),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cardLabelsTable = pgTable("card_labels", {
  cardId: integer("card_id").notNull().references(() => cardsTable.id, { onDelete: "cascade" }),
  labelId: integer("label_id").notNull().references(() => labelsTable.id, { onDelete: "cascade" }),
});

export const insertCardSchema = createInsertSchema(cardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;
