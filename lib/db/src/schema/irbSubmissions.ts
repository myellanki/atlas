import { pgTable, serial, integer, smallint, varchar, date, text, timestamp } from "drizzle-orm/pg-core";

export const irbSubmissionsTable = pgTable("irb_submissions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id"),
  protocolNumber: varchar("protocol_number", { length: 100 }),
  title: varchar("title", { length: 500 }).notNull(),
  pi: varchar("pi", { length: 255 }),
  piEmail: varchar("pi_email", { length: 255 }),
  irbTeamMember: varchar("irb_team_member", { length: 255 }),
  irbTeamMemberEmail: varchar("irb_team_member_email", { length: 255 }),
  submissionType: varchar("submission_type", { length: 50 }).notNull().default("new_study"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  priority: smallint("priority").default(3),
  customLabels: text("custom_labels"),
  submittedDate: date("submitted_date"),
  approvedDate: date("approved_date"),
  expirationDate: date("expiration_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IrbSubmission = typeof irbSubmissionsTable.$inferSelect;
