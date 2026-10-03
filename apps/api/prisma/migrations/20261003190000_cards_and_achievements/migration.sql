-- CreateTable
CREATE TABLE "review_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "ply" INTEGER NOT NULL,
    "fen" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "played_uci" TEXT NOT NULL,
    "played_san" TEXT NOT NULL,
    "solver" CHAR(1) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "interval_days" INTEGER NOT NULL DEFAULT 0,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "last_answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateIndex
CREATE INDEX "review_cards_user_id_due_at_idx" ON "review_cards"("user_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_cards_user_id_game_id_ply_key" ON "review_cards"("user_id", "game_id", "ply");

-- AddForeignKey
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

