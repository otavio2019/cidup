CREATE TABLE "public"."password_reset_token" (
  "id" SERIAL NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "id_usuario" INTEGER NOT NULL,
  CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_token_token_hash_key" ON "public"."password_reset_token"("token_hash");
CREATE INDEX "password_reset_token_id_usuario_expires_at_idx" ON "public"."password_reset_token"("id_usuario", "expires_at");
ALTER TABLE "public"."password_reset_token" ADD CONSTRAINT "password_reset_token_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
