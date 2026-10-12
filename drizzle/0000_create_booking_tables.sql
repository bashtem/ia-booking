CREATE EXTENSION IF NOT EXISTS "btree_gist";
--> statement-breakpoint
CREATE TABLE "advisors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisors_id_not_blank" CHECK (length(btrim("advisors"."id")) > 0),
	CONSTRAINT "advisors_name_not_blank" CHECK (length(btrim("advisors"."name")) > 0)
);

--> statement-breakpoint
CREATE TABLE "availability_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_windows_advisor_start_unique" UNIQUE("advisor_id","starts_at"),
	CONSTRAINT "availability_windows_time_order" CHECK ("availability_windows"."ends_at" > "availability_windows"."starts_at")
);

--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_id" text NOT NULL,
	"candidate_name" text NOT NULL,
	"visa_type" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"held_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_status" CHECK ("bookings"."status" in ('held', 'confirmed', 'expired', 'cancelled')),
	CONSTRAINT "bookings_duration" CHECK (("bookings"."visa_type" = 'A' and "bookings"."ends_at" = "bookings"."starts_at" + interval '30 minutes') or ("bookings"."visa_type" = 'B' and "bookings"."ends_at" = "bookings"."starts_at" + interval '60 minutes')),
	CONSTRAINT "bookings_hold_has_deadline" CHECK ("bookings"."status" <> 'held' or "bookings"."held_until" is not null),
	CONSTRAINT "bookings_candidate_name_not_blank" CHECK (length(btrim("bookings"."candidate_name")) > 0)
);

--> statement-breakpoint
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_advisor_starts_idx" ON "bookings" USING btree ("advisor_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_active_holds_idx" ON "bookings" USING btree ("held_until") WHERE "bookings"."status" = 'held';

--> statement-breakpoint
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_no_overlap" EXCLUDE USING gist (
	"advisor_id" WITH =,
	tstzrange("starts_at", "ends_at", '[)') WITH &&
);

--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist (
	"advisor_id" WITH =,
	tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" IN ('held', 'confirmed'));

--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

--> statement-breakpoint
CREATE TRIGGER advisors_set_updated_at
BEFORE UPDATE ON advisors
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint
CREATE TRIGGER availability_windows_set_updated_at
BEFORE UPDATE ON availability_windows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint
CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION bookings_must_fit_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM availability_windows
    WHERE advisor_id = NEW.advisor_id
      AND starts_at <= NEW.starts_at
      AND ends_at >= NEW.ends_at
  ) THEN
    RAISE EXCEPTION 'booking must fall inside an availability window'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

--> statement-breakpoint
CREATE TRIGGER bookings_must_fit_window
BEFORE INSERT OR UPDATE OF advisor_id, starts_at, ends_at ON bookings
FOR EACH ROW
EXECUTE FUNCTION bookings_must_fit_window();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION availability_windows_keep_active_bookings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE advisor_id = OLD.advisor_id
      AND status IN ('held', 'confirmed')
      AND starts_at >= OLD.starts_at
      AND ends_at <= OLD.ends_at
      AND (
        TG_OP = 'DELETE'
        OR starts_at < NEW.starts_at
        OR ends_at > NEW.ends_at
        OR NEW.advisor_id IS DISTINCT FROM OLD.advisor_id
      )
  ) THEN
    RAISE EXCEPTION 'availability window still contains an active booking'
      USING ERRCODE = '23503';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

--> statement-breakpoint
CREATE TRIGGER availability_windows_keep_active_bookings
BEFORE DELETE OR UPDATE OF advisor_id, starts_at, ends_at ON availability_windows
FOR EACH ROW
EXECUTE FUNCTION availability_windows_keep_active_bookings();
