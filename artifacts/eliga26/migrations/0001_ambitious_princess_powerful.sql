ALTER TABLE "tournament_rewards" DROP CONSTRAINT "tournament_rewards_tournament_id_tournaments_id_fk";
--> statement-breakpoint
ALTER TABLE "tournament_rewards" ALTER COLUMN "tournament_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_rewards" ADD CONSTRAINT "tournament_rewards_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;