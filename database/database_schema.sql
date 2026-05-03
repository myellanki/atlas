CREATE SCHEMA "public";
CREATE TABLE "activity" (
	"id" serial PRIMARY KEY,
	"event_type" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" integer NOT NULL,
	"description" varchar(1000) NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"team_id" integer,
	"card_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "card_attachments" (
	"id" serial PRIMARY KEY,
	"card_id" integer NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(500) NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "card_dependencies" (
	"id" serial PRIMARY KEY,
	"card_id" integer NOT NULL,
	"depends_on_card_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "card_labels" (
	"card_id" integer NOT NULL,
	"label_id" integer NOT NULL
);
CREATE TABLE "card_template_items" (
	"id" serial PRIMARY KEY,
	"template_id" integer NOT NULL,
	"text" varchar(1000) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
CREATE TABLE "card_templates" (
	"id" serial PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(50) DEFAULT '#8b5cf6' NOT NULL,
	"icon" varchar(50) DEFAULT 'ClipboardList' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"assignee_id" integer,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'not_started' NOT NULL,
	"priority" varchar(50) DEFAULT 'medium' NOT NULL,
	"start_date" date,
	"due_date" date,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"data_source" varchar(50),
	"cohort" varchar(150),
	"archived" boolean DEFAULT false NOT NULL
);
CREATE TABLE "checklist_items" (
	"id" serial PRIMARY KEY,
	"card_id" integer NOT NULL,
	"text" varchar(1000) NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY,
	"card_id" integer NOT NULL,
	"author_name" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "custom_tags" (
	"id" serial PRIMARY KEY,
	"category" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(50),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "deliverables" (
	"id" serial PRIMARY KEY,
	"card_id" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"type" varchar(50) DEFAULT 'paper' NOT NULL,
	"target_date" date,
	"status" varchar(50) DEFAULT 'drafting' NOT NULL,
	"journal" varchar(255),
	"first_author" varchar(255),
	"doi" varchar(255),
	"url" text,
	"notes" text,
	"published_year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "irb_submissions" (
	"id" serial PRIMARY KEY,
	"team_id" integer,
	"protocol_number" varchar(100),
	"title" varchar(500) NOT NULL,
	"pi" varchar(255),
	"submission_type" varchar(50) DEFAULT 'new_study' NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"submitted_date" date,
	"approved_date" date,
	"expiration_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"pi_email" varchar(255),
	"irb_team_member" varchar(255),
	"irb_team_member_email" varchar(255),
	"priority" smallint DEFAULT 3,
	"custom_labels" text,
	"archived" boolean DEFAULT false NOT NULL
);
CREATE TABLE "labels" (
	"id" serial PRIMARY KEY,
	"name" varchar(100) NOT NULL,
	"color" varchar(50) DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "links" (
	"id" serial PRIMARY KEY,
	"card_id" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"url" varchar(2000) NOT NULL,
	"linked_card_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "members" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"avatar_color" varchar(50) DEFAULT '#6366f1' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"type" varchar(50) DEFAULT 'general' NOT NULL,
	"color" varchar(50) DEFAULT '#f59e0b' NOT NULL,
	"description" text,
	"card_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY,
	"card_id" integer NOT NULL,
	"content" text NOT NULL,
	"author_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY,
	"type" varchar(50) DEFAULT 'info' NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"read" boolean DEFAULT false NOT NULL,
	"card_id" integer,
	"irb_submission_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "sprints" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"goal" text,
	"color" varchar(50) DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY,
	"slug" varchar(100) NOT NULL CONSTRAINT "teams_slug_unique" UNIQUE,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(50) DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "card_labels" ADD CONSTRAINT "card_labels_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE;
ALTER TABLE "card_labels" ADD CONSTRAINT "card_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE;
ALTER TABLE "card_template_items" ADD CONSTRAINT "card_template_items_template_id_card_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "card_templates"("id") ON DELETE CASCADE;
ALTER TABLE "cards" ADD CONSTRAINT "cards_assignee_id_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "members"("id") ON DELETE SET NULL;
ALTER TABLE "cards" ADD CONSTRAINT "cards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE;
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE;
ALTER TABLE "links" ADD CONSTRAINT "links_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE;
ALTER TABLE "links" ADD CONSTRAINT "links_linked_card_id_cards_id_fk" FOREIGN KEY ("linked_card_id") REFERENCES "cards"("id") ON DELETE SET NULL;
ALTER TABLE "members" ADD CONSTRAINT "members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL;
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE;
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX "activity_pkey" ON "activity" ("id");
CREATE UNIQUE INDEX "card_attachments_pkey" ON "card_attachments" ("id");
CREATE UNIQUE INDEX "card_dependencies_pkey" ON "card_dependencies" ("id");
CREATE UNIQUE INDEX "card_template_items_pkey" ON "card_template_items" ("id");
CREATE UNIQUE INDEX "card_templates_pkey" ON "card_templates" ("id");
CREATE UNIQUE INDEX "cards_pkey" ON "cards" ("id");
CREATE UNIQUE INDEX "checklist_items_pkey" ON "checklist_items" ("id");
CREATE UNIQUE INDEX "comments_pkey" ON "comments" ("id");
CREATE UNIQUE INDEX "custom_tags_pkey" ON "custom_tags" ("id");
CREATE UNIQUE INDEX "deliverables_pkey" ON "deliverables" ("id");
CREATE UNIQUE INDEX "irb_submissions_pkey" ON "irb_submissions" ("id");
CREATE UNIQUE INDEX "labels_pkey" ON "labels" ("id");
CREATE UNIQUE INDEX "links_pkey" ON "links" ("id");
CREATE UNIQUE INDEX "members_pkey" ON "members" ("id");
CREATE UNIQUE INDEX "milestones_pkey" ON "milestones" ("id");
CREATE UNIQUE INDEX "notes_pkey" ON "notes" ("id");
CREATE UNIQUE INDEX "notifications_pkey" ON "notifications" ("id");
CREATE UNIQUE INDEX "sprints_pkey" ON "sprints" ("id");
CREATE UNIQUE INDEX "teams_pkey" ON "teams" ("id");
CREATE UNIQUE INDEX "teams_slug_unique" ON "teams" ("slug");
