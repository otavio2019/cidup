-- CreateTable
CREATE TABLE IF NOT EXISTS "_DenunciaOrgaosExtras" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DenunciaOrgaosExtras_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX IF NOT EXISTS "_DenunciaOrgaosExtras_B_index" ON "_DenunciaOrgaosExtras"("B");

ALTER TABLE "_DenunciaOrgaosExtras" ADD CONSTRAINT "_DenunciaOrgaosExtras_A_fkey" FOREIGN KEY ("A") REFERENCES "denuncia"("id_denuncia") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DenunciaOrgaosExtras" ADD CONSTRAINT "_DenunciaOrgaosExtras_B_fkey" FOREIGN KEY ("B") REFERENCES "orgao"("id_orgao") ON DELETE CASCADE ON UPDATE CASCADE;

-- Órgãos padrão
INSERT INTO "orgao" ("nome", "email", "telefone", "descricao") VALUES
  ('Obras e Infraestrutura', 'obras@cidup.local', '(00) 0000-0001', 'Buracos, calçadas e sinalização viária.'),
  ('Iluminação Pública', 'iluminacao@cidup.local', '(00) 0000-0002', 'Postes, lâmpadas e rede de iluminação.'),
  ('Limpeza Urbana', 'limpeza@cidup.local', '(00) 0000-0003', 'Lixo, entulho e descarte irregular.'),
  ('Meio Ambiente', 'meioambiente@cidup.local', '(00) 0000-0004', 'Árvores, áreas verdes e questões ambientais.'),
  ('Saneamento e Drenagem', 'saneamento@cidup.local', '(00) 0000-0005', 'Alagamentos, esgoto e drenagem.')
ON CONFLICT DO NOTHING;
