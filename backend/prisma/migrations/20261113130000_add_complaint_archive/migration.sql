ALTER TABLE "denuncia"
  ADD COLUMN "arquivada" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "denuncia_arquivada_idx" ON "denuncia"("arquivada");
