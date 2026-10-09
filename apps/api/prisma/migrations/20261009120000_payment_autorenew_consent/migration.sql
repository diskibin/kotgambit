-- The learner's agreement to the automatic renewal is kept with the payment it was given for: not every
-- provider says in its answer whether the card was kept
ALTER TABLE "payments" ADD COLUMN "auto_renew_consent" BOOLEAN NOT NULL DEFAULT false;
