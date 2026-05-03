import { pgTable, serial, integer, varchar, date, text, timestamp } from "drizzle-orm/pg-core";

export const irbSubmissionsTable = pgTable("irb_submissions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id"),
  protocolNumber: varchar("protocol_number", { length: 100 }),
  title: varchar("title", { length: 500 }).notNull(),
  pi: varchar("pi", { length: 255 }),
  submissionType: varchar("submission_type", { length: 50 }).notNull().default("new_study"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  submittedDate: date("submitted_date"),
  approvedDate: date("approved_date"),
  expirationDate: date("expiration_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IrbSubmission = typeof irbSubmissionsTable.$inferSelect;
