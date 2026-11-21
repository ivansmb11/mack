-- CreateTable
CREATE TABLE "Agent" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domains" JSONB NOT NULL,
    "port" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Budget" (
    "agentName" TEXT NOT NULL PRIMARY KEY,
    "monthlyTokens" INTEGER,
    "monthlyUsd" REAL,
    CONSTRAINT "Budget_agentName_fkey" FOREIGN KEY ("agentName") REFERENCES "Agent" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agent" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costUsd" REAL,
    "source" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "monthlyUsd" REAL NOT NULL,
    "renewsOn" TEXT,
    "monthlyTokenQuota" INTEGER,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "FactoryJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "maxIterations" INTEGER NOT NULL,
    "setupCommand" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "commits" JSONB NOT NULL DEFAULT [],
    "output" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_port_key" ON "Agent"("port");

-- CreateIndex
CREATE INDEX "Usage_agent_at_idx" ON "Usage"("agent", "at");

-- CreateIndex
CREATE INDEX "FactoryJob_status_createdAt_idx" ON "FactoryJob"("status", "createdAt");
