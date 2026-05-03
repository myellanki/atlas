import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";

export const cardAttachmentsTable = pgTable("card_attachments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export type CardAttachment = typeof cardAttachmentsTable.$inferSelect;
