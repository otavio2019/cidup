CREATE TABLE "notificacao" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario" INTEGER,
    "id_responsavel" INTEGER,
    "id_denuncia" INTEGER,
    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notificacao_id_usuario_lida_data_criacao_idx" ON "notificacao"("id_usuario", "lida", "data_criacao");
CREATE INDEX "notificacao_id_responsavel_lida_data_criacao_idx" ON "notificacao"("id_responsavel", "lida", "data_criacao");
CREATE INDEX "notificacao_id_denuncia_data_criacao_idx" ON "notificacao"("id_denuncia", "data_criacao");

ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "responsavel"("id_responsavel") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_id_denuncia_fkey" FOREIGN KEY ("id_denuncia") REFERENCES "denuncia"("id_denuncia") ON DELETE CASCADE ON UPDATE CASCADE;
