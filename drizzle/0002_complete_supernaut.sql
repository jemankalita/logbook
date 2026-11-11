CREATE TYPE "public"."entry_status" AS ENUM('todo', 'doing', 'done');--> statement-breakpoint
CREATE TYPE "public"."list_kind" AS ENUM('watchlist', 'people', 'generic');--> statement-breakpoint
CREATE TABLE "list_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"url" text,
	"notes" text,
	"status" "entry_status" DEFAULT 'todo' NOT NULL,
	"rating" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"kind" "list_kind" DEFAULT 'generic' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "body_text" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "preview_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "journal" ADD COLUMN "body_text" text;--> statement-breakpoint
ALTER TABLE "journal" ADD COLUMN "mood" integer;--> statement-breakpoint
ALTER TABLE "paths" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "paths" ADD COLUMN "body_text" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "path_id" uuid;--> statement-breakpoint
ALTER TABLE "list_entries" ADD CONSTRAINT "list_entries_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_entries_list_idx" ON "list_entries" USING btree ("list_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_url_idx" ON "items" USING btree ("url");--> statement-breakpoint
CREATE INDEX "items_kind_idx" ON "items" USING btree ("kind");