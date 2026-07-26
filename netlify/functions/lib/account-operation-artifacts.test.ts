// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sqlPath = resolve(repoRoot, "docs/operations/advertising-game-account-progress.sql");
const operationsPath = resolve(repoRoot, "docs/operations/advertising-game-account-progress.md");
const edgeSqlPath = resolve(repoRoot, "docs/operations/advertising-game-edge-gateway.sql");
const edgeIndexPath = resolve(repoRoot, "supabase/functions/advertising-game-backend/index.ts");
const supabaseConfigPath = resolve(repoRoot, "supabase/config.toml");

describe("account progress operation artifacts", () => {
  it("keeps the progress table private and the unique public RPC service-role-only", () => {
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toContain("create schema advertising_game");
    expect(sql).toContain("create table advertising_game.progress");
    expect(sql).not.toMatch(/\bif\s+not\s+exists\b/iu);
    expect(sql).not.toMatch(/\bcreate\s+or\s+replace\b/iu);
    expect(sql).toContain("references auth.users (id) on delete cascade");
    expect(sql).toContain("alter table advertising_game.progress enable row level security");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("public.advertising_game_progress_rpc");
    expect(sql).toMatch(/revoke all\s+on function public\.advertising_game_progress_rpc[\s\S]+from public, anon, authenticated/iu);
    expect(sql).toMatch(/grant execute\s+on function public\.advertising_game_progress_rpc[\s\S]+to service_role/iu);
    const executableSql = sql.replace(/^\s*--.*$/gmu, "");
    expect(executableSql).not.toContain("signal_lost");
  });

  it("enforces document ownership, count, JSON size, and monotonic compare-and-swap", () => {
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toContain("primary key (user_id, document_id)");
    expect(sql).toContain("revision = revision + 1");
    expect(sql).toContain("p_expected_revision");
    expect(sql).toContain(">= 16");
    expect(sql).toContain("262144");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("'currentRevision'");
    expect(sql).not.toMatch(/^\s*(drop|truncate)\b/imu);
  });

  it("resets only the authenticated user's progress under the existing advisory lock", () => {
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toContain("p_operation not in ('list', 'load', 'save', 'reset')");
    expect(sql).toMatch(
      /if p_operation = 'reset' then[\s\S]+perform pg_catalog\.pg_advisory_xact_lock[\s\S]+delete from advertising_game\.progress[\s\S]+where progress\.user_id = p_user_id[\s\S]+return pg_catalog\.jsonb_build_object\('status', 'reset'\)/iu
    );
  });

  it("keeps the Edge broker behind a one-purpose digest gate and service-role-only RPCs", () => {
    for (const path of [edgeSqlPath, edgeIndexPath, supabaseConfigPath]) {
      expect(existsSync(path), path).toBe(true);
    }
    const sql = readFileSync(edgeSqlPath, "utf8");
    const index = readFileSync(edgeIndexPath, "utf8");
    const config = readFileSync(supabaseConfigPath, "utf8");
    expect(sql).toContain("create table advertising_game.backend_gateway");
    expect(sql).toContain("extensions.digest");
    expect(sql).toContain("coalesce(");
    expect(sql).not.toContain("pg_catalog.coalesce");
    expect(sql).toContain("public.advertising_game_backend_authorized");
    expect(sql).toMatch(/revoke all[\s\S]+advertising_game_backend_authorized[\s\S]+from public, anon, authenticated, service_role/iu);
    expect(sql).toMatch(/grant execute[\s\S]+advertising_game_backend_authorized[\s\S]+to service_role/iu);
    expect(sql).toMatch(/decode\('[a-f0-9]{64}',\s*'hex'\)/u);
    expect(sql.replace(/^\s*--.*$/gmu, "")).not.toContain("signal_lost");
    expect(index).toContain("createAdvertisingGameBackendHandler");
    expect(index).toContain("SUPABASE_SECRET_KEYS");
    expect(index).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(config).toMatch(/\[functions\.advertising-game-backend\][\s\S]+verify_jwt\s*=\s*false/u);
  });

  it("lists only generic environment names and non-destructive verification steps", () => {
    const operations = readFileSync(operationsPath, "utf8");
    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
      "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
      "ADVERTISING_GAME_CLASSROOM_CODE",
      "ADVERTISING_GAME_ASSET_NAMESPACE_SECRET"
    ]) {
      expect(operations).toContain(`${name}=<`);
    }
    expect(operations).toContain("20260719071834");
    expect(operations).toContain("apply exactly once");
    expect(operations).toContain("SUPABASE_PROJECT_REF=<project-ref>");
    expect(operations).toContain("advertising-game-account-assets-v1");
    expect(operations).toContain("4 MiB");
    expect(operations).toContain("32 assets");
    expect(operations).toContain("32 MiB");
    expect(operations).toContain("no delete endpoint");
    expect(operations).toContain("shared-project collision preflight");
    expect(operations).toContain("has_schema_privilege");
    expect(operations).toContain("has_table_privilege");
    expect(operations).toContain("accounts.admarket.invalid");
    expect(operations).toContain("username-enumeration trade-off");
    expect(operations).not.toContain(environmentSecretSentinel);
  });
});

const environmentSecretSentinel = `sb_${"secret"}_${"x".repeat(24)}`;
