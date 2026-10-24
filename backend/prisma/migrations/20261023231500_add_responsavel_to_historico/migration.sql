-- AlterTable
ALTER TABLE "public"."historico" ADD COLUMN "id_responsavel" INTEGER;

-- Make the author relation optional for responsible-authored histories.
ALTER TABLE "public"."historico" ALTER COLUMN "id_usuario" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."historico" ADD CONSTRAINT "historico_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "public"."responsavel"("id_responsavel") ON DELETE NO ACTION ON UPDATE NO ACTION;
