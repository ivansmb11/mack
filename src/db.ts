import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
create table if not exists agents (
  name        text primary key,
  kind        text not null check (kind in ('orchestrator', 'dsa')),
  description text not null,
  domains     text not null,
  port        integer not null unique,
  provider    text not null,
  model       text not null,
  spec        text not null,
  created_at  text not null default (datetime('now'))
);
create table if not exists usage (
  id                integer primary key autoincrement,
  agent             text not null,
  model             text not null,
  prompt_tokens     integer not null,
  completion_tokens integer not null,
  cost_usd          real,
  source            text not null,
  at                text not null default (datetime('now'))
);
create index if not exists usage_agent_at on usage (agent, at);
create table if not exists budgets (
  agent          text primary key,
  monthly_tokens integer,
  monthly_usd    real
);
create table if not exists subscriptions (
  id                  text primary key,
  provider            text not null,
  plan                text not null,
  monthly_usd         real not null,
  renews_on           text,
  monthly_token_quota integer,
  notes               text
);
`;

export type Db = DatabaseSync;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("pragma journal_mode = wal; pragma foreign_keys = on;");
  db.exec(SCHEMA);
  return db;
}
