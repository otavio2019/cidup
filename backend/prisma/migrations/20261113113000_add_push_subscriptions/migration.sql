CREATE TABLE "push_subscription" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "id_usuario" INTEGER,
    "id_responsavel" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");
CREATE INDEX "push_subscription_id_usuario_idx" ON "push_subscription"("id_usuario");
CREATE INDEX "push_subscription_id_responsavel_idx" ON "push_subscription"("id_responsavel");

ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_id_responsavel_fkey"
  FOREIGN KEY ("id_responsavel") REFERENCES "responsavel"("id_responsavel") ON DELETE CASCADE ON UPDATE CASCADE;
