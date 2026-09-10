-- CreateTable
CREATE TABLE "sales_goal_teams" (
    "sales_goal_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "sales_goal_teams_pkey" PRIMARY KEY ("sales_goal_id","team_id")
);

-- CreateIndex
CREATE INDEX "sales_goal_teams_team_id_idx" ON "sales_goal_teams"("team_id");

-- AddForeignKey
ALTER TABLE "sales_goal_teams" ADD CONSTRAINT "sales_goal_teams_sales_goal_id_fkey" FOREIGN KEY ("sales_goal_id") REFERENCES "sales_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_teams" ADD CONSTRAINT "sales_goal_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
