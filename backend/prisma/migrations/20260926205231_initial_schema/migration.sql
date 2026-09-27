-- CreateEnum
CREATE TYPE "public"."ComplaintStatus" AS ENUM ('RECEIVED', 'IN_ANALYSIS', 'FORWARDED', 'IN_SERVICE', 'RESOLVED', 'NOT_SERVED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComplaintType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ComplaintType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Complaint" (
    "id" SERIAL NOT NULL,
    "protocol" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "complement" TEXT,
    "status" "public"."ComplaintStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintType_name_key" ON "public"."ComplaintType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_protocol_key" ON "public"."Complaint"("protocol");

-- CreateIndex
CREATE INDEX "Complaint_userId_idx" ON "public"."Complaint"("userId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "public"."Complaint"("status");

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."ComplaintType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
