-- CreateTable
CREATE TABLE "FactoryStep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactoryStep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FactoryJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FactoryStep_jobId_id_idx" ON "FactoryStep"("jobId", "id");

