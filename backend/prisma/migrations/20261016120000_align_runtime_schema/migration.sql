ALTER TABLE "usuarios" RENAME TO "usuario";
ALTER TABLE "usuario" RENAME COLUMN "id" TO "id_usuario";
ALTER TABLE "usuario" RENAME COLUMN "name" TO "nome";
ALTER TABLE "usuario" RENAME COLUMN "passwordHash" TO "senha";
ALTER TABLE "usuario" ALTER COLUMN "nome" TYPE VARCHAR(150);
ALTER TABLE "usuario" ALTER COLUMN "email" TYPE VARCHAR(255);
ALTER TABLE "usuario" ALTER COLUMN "senha" TYPE VARCHAR(255);
ALTER TABLE "usuario" ADD COLUMN "telefone" VARCHAR(20);
CREATE UNIQUE INDEX "usuario_telefone_key" ON "usuario"("telefone");

CREATE TABLE "orgao" (
    "id_orgao" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "descricao" TEXT NOT NULL,
    CONSTRAINT "orgao_pkey" PRIMARY KEY ("id_orgao")
);
CREATE UNIQUE INDEX "orgao_email_key" ON "orgao"("email");
CREATE UNIQUE INDEX "orgao_telefone_key" ON "orgao"("telefone");

CREATE TABLE "denuncia" (
    "id_denuncia" SERIAL NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "data_registro" DATE NOT NULL DEFAULT CURRENT_DATE,
    "endereco" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_orgao" INTEGER NOT NULL,
    CONSTRAINT "denuncia_pkey" PRIMARY KEY ("id_denuncia"),
    CONSTRAINT "denuncia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "denuncia_id_orgao_fkey" FOREIGN KEY ("id_orgao") REFERENCES "orgao"("id_orgao") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "historico" (
    "id_historico" SERIAL NOT NULL,
    "descricao" TEXT NOT NULL,
    "foto" TEXT NOT NULL,
    "observacao" TEXT NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_denuncia" INTEGER NOT NULL,
    CONSTRAINT "historico_pkey" PRIMARY KEY ("id_historico"),
    CONSTRAINT "historico_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "historico_id_denuncia_fkey" FOREIGN KEY ("id_denuncia") REFERENCES "denuncia"("id_denuncia") ON DELETE NO ACTION ON UPDATE NO ACTION
);