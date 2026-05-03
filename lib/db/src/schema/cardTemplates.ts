import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const cardTemplatesTable = pgTable("card_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 50 }).notNull().default("#8b5cf6"),
  icon: varchar("icon", { length: 50 }).notNull().default("ClipboardList"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cardTemplateItemsTable = pgTable("card_template_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => cardTemplatesTable.id, { onDelete: "cascade" }),
  text: varchar("text", { length: 1000 }).notNull(),
  position: integer("position").notNull().default(0),
});

export type CardTemplate = typeof cardTemplatesTable.$inferSelect;
export type CardTemplateItem = typeof cardTemplateItemsTable.$inferSelect;
