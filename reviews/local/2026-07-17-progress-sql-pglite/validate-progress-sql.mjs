import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '../../../node_modules/.pnpm/@electric-sql+pglite@0.3.16/node_modules/@electric-sql/pglite/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '../../..');
const migrationPath = path.join(gameRoot, 'docs/operations/advertising-game-account-progress.sql');
const migration = await readFile(migrationPath, 'utf8');
const migrationSha256 = createHash('sha256').update(migration).digest('hex');
const db = new PGlite();
const evidence = [];

function record(name, detail) {
  evidence.push({ name, detail });
}

async function query(sql, params = []) {
  return (await db.query(sql, params)).rows;
}

async function rpc(role, userId, operation, documentId, expectedRevision, document) {
  await db.exec(`set role ${role}`);
  try {
    const rows = await query(
      `select public.advertising_game_progress_rpc(
         $1::uuid, $2::text, $3::text, 'advertising-game-progress', 1,
         $4::bigint, $5::jsonb
       ) as result`,
      [userId, operation, documentId, expectedRevision, document == null ? null : JSON.stringify(document)],
    );
    return rows[0].result;
  } finally {
    await db.exec('reset role');
  }
}

async function expectError(name, action, pattern) {
  try {
    await action();
    assert.fail(`${name}: expected an error`);
  } catch (error) {
    assert.match(String(error.message ?? error), pattern, name);
    record(name, { error: String(error.message ?? error) });
  }
}

function documentFor(documentId, revision = 0, teamId = 'team-1') {
  return {
    schemaVersion: 1,
    documentId,
    mode: 'offline',
    teamId,
    revision,
    campaign: { name: documentId },
  };
}

try {
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    insert into auth.users (id) values
      ('11111111-1111-1111-1111-111111111111'),
      ('22222222-2222-2222-2222-222222222222');
    create table public.signal_lost (id integer primary key, payload text not null);
    insert into public.signal_lost values (7, 'must-remain-untouched');
  `);
  record('bootstrap', { roles: ['anon', 'authenticated', 'service_role'], authUsers: 2, sentinel: 'public.signal_lost' });

  await db.exec(migration);
  record('migration-execution', { migrationSha256, status: 'executed exactly as read' });

  const [role] = await query(`
    select rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole,
           rolreplication, rolbypassrls,
           not exists (
             select 1 from pg_catalog.pg_auth_members m
             where m.roleid = r.oid or m.member = r.oid
           ) as has_no_memberships
    from pg_catalog.pg_roles r
    where rolname = 'advertising_game_progress_owner_20260718'
  `);
  assert.deepEqual(role, {
    rolcanlogin: false, rolinherit: false, rolsuper: false, rolcreatedb: false,
    rolcreaterole: false, rolreplication: false, rolbypassrls: false, has_no_memberships: true,
  });
  record('owner-role-flags-and-membership', role);

  const [catalog] = await query(`
    select
      (select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'advertising_game') as schema_owner,
      (select pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'advertising_game' and c.relname = 'progress') as table_owner,
      (select pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'advertising_game_progress_rpc') as function_owner,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'advertising_game_progress_rpc') as named_rpc_count,
      (select count(*) from pg_proc p where p.oid = to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)')) as exact_signature_count
  `);
  assert.deepEqual(catalog, {
    schema_owner: 'advertising_game_progress_owner_20260718',
    table_owner: 'advertising_game_progress_owner_20260718',
    function_owner: 'advertising_game_progress_owner_20260718',
    named_rpc_count: 1,
    exact_signature_count: 1,
  });
  record('exact-object-owners-and-signature', catalog);

  const [access] = await query(`
    select c.relrowsecurity as rls_enabled,
           (select count(*) from pg_policies where schemaname = 'advertising_game' and tablename = 'progress') as direct_policy_count,
           has_schema_privilege('anon', n.oid, 'USAGE') as anon_schema_usage,
           has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_schema_usage,
           has_schema_privilege('service_role', n.oid, 'USAGE') as service_schema_usage,
           has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as anon_table_dml,
           has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as authenticated_table_dml,
           has_table_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as service_table_dml,
           p.prosecdef as security_definer,
           p.proconfig::text as function_settings,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join pg_proc p
    where n.nspname = 'advertising_game' and c.relname = 'progress'
      and p.oid = to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)')
  `);
  assert.match(access.function_settings, /search_path=/);
  assert.deepEqual({ ...access, function_settings: '<contains search_path=>' }, {
    rls_enabled: true, direct_policy_count: 0,
    anon_schema_usage: false, authenticated_schema_usage: false, service_schema_usage: false,
    anon_table_dml: false, authenticated_table_dml: false, service_table_dml: false,
    security_definer: true, function_settings: '<contains search_path=>',
    anon_can_execute: false, authenticated_can_execute: false, service_role_can_execute: true,
  });
  record('rls-direct-grants-and-function-grant', access);

  const userOne = '11111111-1111-1111-1111-111111111111';
  const userTwo = '22222222-2222-2222-2222-222222222222';
  // The migration's exact qualified COALESCE expression compiles, but PGlite
  // resolves it as a nonexistent pg_catalog function at first list execution.
  await expectError('pglite-list-incompatibility', () => rpc('service_role', userOne, 'list', null, null, null), /function pg_catalog\.coalesce\(jsonb, jsonb\) does not exist/);
  assert.deepEqual(await rpc('service_role', userOne, 'load', 'alpha', null, null), { status: 'not_found' });
  assert.equal((await rpc('service_role', userOne, 'save', 'alpha', 0, documentFor('alpha'))).status, 'saved');
  const loaded = await rpc('service_role', userOne, 'load', 'alpha', null, null);
  assert.equal(loaded.status, 'found');
  assert.equal(loaded.document.teamId, 'team-1');
  assert.equal((await rpc('service_role', userOne, 'save', 'alpha', 1, documentFor('alpha', 1))).revision, 2);
  assert.deepEqual(await rpc('service_role', userOne, 'save', 'alpha', 1, documentFor('alpha', 1)), { status: 'conflict', currentRevision: 2 });
  record('load-save-cas-conflict', { loaded: true, firstRevision: 1, secondRevision: 2, staleWrite: 'conflict/currentRevision=2' });

  const missingTeam = documentFor('missing-team');
  delete missingTeam.teamId;
  await expectError('missing-teamId-rejected', () => rpc('service_role', userOne, 'save', 'missing-team', 0, missingTeam), /invalid document identity/);
  await expectError('empty-teamId-rejected', () => rpc('service_role', userOne, 'save', 'empty-team', 0, documentFor('empty-team', 0, '')), /invalid document identity/);

  assert.equal((await rpc('service_role', userTwo, 'save', 'other-user', 0, documentFor('other-user'))).status, 'saved');
  assert.deepEqual(await rpc('service_role', userOne, 'load', 'other-user', null, null), { status: 'not_found' });
  record('account-isolation', { userOneLoadsOtherUserDocument: 'not_found' });

  for (const id of ['bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa']) {
    assert.equal((await rpc('service_role', userOne, 'save', id, 0, documentFor(id))).status, 'saved');
  }
  assert.deepEqual(await rpc('service_role', userOne, 'save', 'quebec', 0, documentFor('quebec')), { status: 'document_limit' });
  const [{ storedCount }] = await query('select count(*)::integer as "storedCount" from advertising_game.progress where user_id = $1::uuid', [userOne]);
  assert.equal(storedCount, 16);
  record('document-cap', { savedDistinctDocuments: 16, seventeenth: 'document_limit', storedCount, listOperation: 'blocked by qualified COALESCE resolution' });

  await expectError('anon-rpc-denied', () => rpc('anon', userOne, 'list', null, null, null), /permission denied for function/);
  await expectError('authenticated-rpc-denied', () => rpc('authenticated', userOne, 'list', null, null, null), /permission denied for function/);
  await expectError('service-role-direct-table-denied', async () => {
    await db.exec('set role service_role');
    try { await query('select * from advertising_game.progress'); } finally { await db.exec('reset role'); }
  }, /permission denied for schema|permission denied for table/);
  record('role-isolated-rpc-execution', { serviceRoleRpc: 'allowed', anonRpc: 'denied', authenticatedRpc: 'denied', serviceRoleDirectTable: 'denied' });

  const sentinel = await query('select id, payload from public.signal_lost');
  assert.deepEqual(sentinel, [{ id: 7, payload: 'must-remain-untouched' }]);
  record('unrelated-sentinel', { untouched: true, rows: sentinel });

  console.log(JSON.stringify({
    status: 'BLOCKED_BY_PGLITE_LIST_EXECUTION',
    pgliteVersion: '0.3.16',
    migrationSha256,
    blocker: 'list reaches pg_catalog.coalesce(jsonb, jsonb), which PGlite 0.3.16 reports does not exist; all non-list checks below ran against the exact migration.',
    checks: evidence,
  }, null, 2));
} finally {
  await db.close();
}
