ALTER TABLE "usuario"
  ADD COLUMN "cpf" VARCHAR(11),
  ADD COLUMN "cep" VARCHAR(8),
  ADD COLUMN "foto" TEXT;

CREATE UNIQUE INDEX "usuario_cpf_key" ON "usuario"("cpf");

ALTER TABLE "denuncia"
  ADD COLUMN "foto" TEXT;
