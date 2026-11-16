CREATE TABLE "import_map" (
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_map_source_external_id_pk" PRIMARY KEY("source","external_id")
);
