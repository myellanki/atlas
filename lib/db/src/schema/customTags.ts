import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const customTagsTable = pgTable("custom_tags", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 50 }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CustomTag = typeof customTagsTable.$inferSelect;

export const CreateCustomTagBody = z.object({
  category: z.enum(["data_source", "cohort"]),
  name: z.string().min(1).max(255),
  color: z.string().optional(),
  position: z.number().int().optional(),
});

export const UpdateCustomTagBody = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
});
