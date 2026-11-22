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
    "color" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "threadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Agent" ("color", "createdAt", "description", "domains", "kind", "model", "name", "provider", "spec", "threadId") SELECT "color", "createdAt", "description", "domains", "kind", "model", "name", "provider", "spec", "threadId" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
