CREATE TYPE "public"."effort" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('link', 'note', 'list_item', 'person');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('unread', 'read', 'done');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('article', 'course', 'video', 'tool', 'idea', 'note', 'tweet', 'other');--> statement-breakpoint
CREATE TYPE "public"."opp_status" AS ENUM('inbox', 'interested', 'applying', 'submitted', 'interview', 'result', 'closed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."task_horizon" AS ENUM('daily', 'upcoming', 'roadmap');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('not_started', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "attendance" (
	"day" date PRIMARY KEY NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"color" text,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_tags" (
	"item_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "item_tags_item_id_tag_id_pk" PRIMARY KEY("item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid,
	"kind" "item_kind" DEFAULT 'link' NOT NULL,
	"type" "item_type" DEFAULT 'other' NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"summary" text,
	"description" text,
	"image" text,
	"favicon" text,
	"body" jsonb,
	"status" "item_status" DEFAULT 'unread' NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"actionable" boolean DEFAULT false NOT NULL,
	"deadline" date,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"day" date PRIMARY KEY NOT NULL,
	"body" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"status" "opp_status" DEFAULT 'inbox' NOT NULL,
	"link" text,
	"deadline" date,
	"next_action" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"body" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"task_id" uuid NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "task_completions_task_id_day_pk" PRIMARY KEY("task_id","day")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"horizon" "task_horizon" DEFAULT 'daily' NOT NULL,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"priority" "priority",
	"effort" "effort",
	"area" text,
	"parent_id" uuid,
	"due_date" date,
	"recurrence" text,
	"done_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"area" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folders_parent_idx" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "items_folder_idx" ON "items" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "items_created_idx" ON "items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_completions_day_idx" ON "task_completions" USING btree ("day");--> statement-breakpoint
CREATE INDEX "tasks_horizon_idx" ON "tasks" USING btree ("horizon");--> statement-breakpoint
CREATE INDEX "tasks_done_idx" ON "tasks" USING btree ("done_at");--> statement-breakpoint
CREATE INDEX "time_blocks_start_idx" ON "time_blocks" USING btree ("starts_at");