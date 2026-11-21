/*
  Warnings:

  - You are about to drop the column `port` on the `Agent` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domains" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Agent" ("createdAt", "description", "domains", "kind", "model", "name", "provider", "spec") SELECT "createdAt", "description", "domains", "kind", "model", "name", "provider", "spec" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
