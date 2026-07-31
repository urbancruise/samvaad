-- CreateEnum
CREATE TYPE "RaterType" AS ENUM ('SELF', 'SENIOR');

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "raterId" INTEGER NOT NULL,
    "raterType" "RaterType" NOT NULL,
    "period" TEXT NOT NULL,
    "departmentId" INTEGER,
    "salesScore" INTEGER,
    "conductScore" INTEGER,
    "contributionScore" INTEGER,
    "achievementPercent" DOUBLE PRECISION,
    "extraFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_employeeId_period_idx" ON "Rating"("employeeId", "period");

-- CreateIndex
CREATE INDEX "Rating_departmentId_period_idx" ON "Rating"("departmentId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_employeeId_raterType_period_key" ON "Rating"("employeeId", "raterType", "period");
