ALTER TABLE "denuncia"
  ADD COLUMN "categorias" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "atualizada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "denuncia"
SET "categorias" = ARRAY["tipo"]::TEXT[],
    "atualizada_em" = "data_registro"::TIMESTAMP;

ALTER TABLE "historico"
  ADD COLUMN "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "historico" AS h
SET "data_criacao" = d."data_registro"::TIMESTAMP
FROM "denuncia" AS d
WHERE h."id_denuncia" = d."id_denuncia";
