// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sqlPath = resolve(
  repoRoot,
  "docs/operations/advertising-game-image-lab-allowances.sql"
);

const executableSql = (): string =>
  readFileSync(sqlPath, "utf8").replace(/^\s*--.*$/gmu, "");

describe("Image Lab allowance operation artifacts", () => {
  it("creates each private object and the public broker exactly once", () => {
    const sql = executableSql();
    expect(sql.match(/\bcreate\s+table\s+advertising_game\.image_lab_settings\b/giu))
      .toHaveLength(1);
    expect(sql.match(/\bcreate\s+table\s+advertising_game\.image_lab_allowance\b/giu))
      .toHaveLength(1);
    expect(sql.match(/\bcreate\s+table\s+advertising_game\.image_lab_operation\b/giu))
      .toHaveLength(1);
    expect(sql.match(/\bcreate\s+function\s+public\.advertising_game_image_lab_rpc\b/giu))
      .toHaveLength(1);
    expect(sql).not.toMatch(/\bif\s+not\s+exists\b|\bcreate\s+or\s+replace\b/iu);
  });

  it("keeps all ledger tables private with defence-in-depth RLS and no browser grants", () => {
    const sql = executableSql();
    for (const table of [
      "image_lab_settings",
      "image_lab_allowance",
      "image_lab_operation"
    ]) {
      expect(sql).toContain(`create table advertising_game.${table}`);
      expect(sql).toContain(
        `alter table advertising_game.${table} enable row level security`
      );
      expect(sql).toMatch(new RegExp(
        `revoke all\\s+on table advertising_game\\.${table}\\s+from public, anon, authenticated, service_role`,
        "iu"
      ));
    }
    expect(sql).toMatch(
      /revoke all\s+on schema advertising_game\s+from public, anon, authenticated/iu
    );
    expect(sql).toMatch(
      /revoke all\s+on all sequences in schema advertising_game\s+from public, anon, authenticated/iu
    );
    expect(sql).not.toMatch(/\bgrant\b[\s\S]{0,120}\bto\s+(public|anon|authenticated)\b/iu);
  });

  it("owns the service-only security-definer RPC with a closed search path", () => {
    const sql = executableSql();
    expect(sql).toMatch(
      /create function public\.advertising_game_image_lab_rpc[\s\S]+security definer[\s\S]+set search_path = ''/iu
    );
    expect(sql).toMatch(
      /alter function public\.advertising_game_image_lab_rpc[\s\S]+owner to postgres/iu
    );
    expect(sql).toMatch(
      /revoke all\s+on function public\.advertising_game_image_lab_rpc[\s\S]+from public, anon, authenticated/iu
    );
    expect(sql).toMatch(
      /grant execute\s+on function public\.advertising_game_image_lab_rpc[\s\S]+to service_role/iu
    );
  });

  it("bounds account counters and ties allowance ownership to auth users", () => {
    const sql = executableSql();
    expect(sql).toContain("references auth.users (id) on delete cascade");
    for (const counter of [
      "object_granted",
      "object_consumed",
      "object_reserved",
      "realise_granted",
      "realise_consumed",
      "realise_reserved"
    ]) {
      expect(sql).toMatch(new RegExp(
        `${counter}\\s+integer\\s+not null[\\s\\S]{0,180}${counter}\\s+between\\s+0\\s+and\\s+100`,
        "iu"
      ));
    }
    expect(sql).toContain("object_consumed + object_reserved <= object_granted");
    expect(sql).toContain("realise_consumed + realise_reserved <= realise_granted");
  });

  it("does not lazily give changed future-account defaults to existing accounts", () => {
    const sql = executableSql();
    expect(sql).toMatch(
      /insert into advertising_game\.image_lab_allowance\s*\(\s*user_id,\s*object_granted,\s*realise_granted\s*\)\s*values\s*\(\s*p_user_id,\s*0,\s*0\s*\)\s*on conflict \(user_id\) do nothing/iu
    );
  });

  it("serializes user and global mutations and journals immutable request identity", () => {
    const sql = executableSql();
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(sql).toContain("image-lab-global");
    expect(sql).toContain("p_user_id::text");
    expect(sql).toContain("operation_id text primary key");
    expect(sql).toContain("request_hash text not null");
    expect(sql).toContain("job_key text");
    expect(sql).toMatch(
      /where image_lab_operation\.operation_id = p_operation_id[\s\S]+request_hash is distinct from p_request_hash[\s\S]+raise exception/iu
    );
    for (const field of ["user_id", "stage", "amount", "job_key"]) {
      expect(sql).toMatch(new RegExp(
        `image_lab_operation\\.${field}\\s+is distinct from p_${field}`,
        "iu"
      ));
    }
  });

  it("implements one-way idempotent reservation terminal transitions", () => {
    const sql = executableSql();
    for (const operation of [
      "status",
      "global_status",
      "set_global",
      "set",
      "add",
      "revoke",
      "reserve",
      "complete",
      "refund",
      "mark_uncertain",
      "list"
    ]) {
      expect(sql).toContain(`'${operation}'`);
    }
    expect(sql).toMatch(
      /p_operation = 'reserve'[\s\S]+operation_status[\s\S]+'reserved'/iu
    );
    expect(sql).toMatch(
      /p_operation = 'complete'[\s\S]+operation_status is distinct from 'reserved'[\s\S]+object_reserved = object_reserved - 1[\s\S]+object_consumed = object_consumed \+ 1/iu
    );
    expect(sql).toMatch(
      /p_operation = 'refund'[\s\S]+operation_status is distinct from 'reserved'[\s\S]+object_reserved = object_reserved - 1/iu
    );
    expect(sql).toMatch(
      /p_operation = 'mark_uncertain'[\s\S]+operation_status is distinct from 'reserved'[\s\S]+outcome_uncertain = true/iu
    );
    expect(sql).toMatch(
      /operation_status in \('completed', 'refunded'\)[\s\S]+return/iu
    );
  });

  it("returns aliases only through the service broker contract", () => {
    const sql = executableSql();
    expect(sql).toContain("p_operation = 'list'");
    expect(sql).toContain("'userId'");
    expect(sql).not.toContain("'alias'");
    expect(sql).not.toMatch(/\bfrom\s+auth\.(users|identities)\b/iu);
    expect(sql.replace(/^\s*--.*$/gmu, "")).not.toContain("signal_lost");
  });
});
