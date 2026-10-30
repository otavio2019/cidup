ALTER TABLE "public"."usuario"
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "public"."password_recovery_request" (
  "id" SERIAL NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "id_usuario" INTEGER NOT NULL,
  "id_responsavel" INTEGER,
  CONSTRAINT "password_recovery_request_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_recovery_request_id_usuario_key"
ON "public"."password_recovery_request"("id_usuario");
CREATE INDEX "password_recovery_request_status_requested_at_idx"
ON "public"."password_recovery_request"("status", "requested_at");
ALTER TABLE "public"."password_recovery_request"
ADD CONSTRAINT "password_recovery_request_id_usuario_fkey"
FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."password_recovery_request"
ADD CONSTRAINT "password_recovery_request_id_responsavel_fkey"
FOREIGN KEY ("id_responsavel") REFERENCES "public"."responsavel"("id_responsavel")
ON DELETE SET NULL ON UPDATE CASCADE;
