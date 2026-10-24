
-- CreateTable
CREATE TABLE "public"."responsavel" (
    "id_responsavel" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "id_orgao" INTEGER NOT NULL,
    CONSTRAINT "responsavel_pkey" PRIMARY KEY ("id_responsavel")
);

-- CreateIndex
CREATE UNIQUE INDEX "responsavel_email_key" ON "public"."responsavel"("email");

-- AddForeignKey
ALTER TABLE "public"."responsavel" ADD CONSTRAINT "responsavel_id_orgao_fkey" FOREIGN KEY ("id_orgao") REFERENCES "public"."orgao"("id_orgao") ON DELETE NO ACTION ON UPDATE NO ACTION;
