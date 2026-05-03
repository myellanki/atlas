import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const cardDependenciesTable = pgTable("card_dependencies", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  dependsOnCardId: integer("depends_on_card_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CardDependency = typeof cardDependenciesTable.$inferSelect;
