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

function topLevelSqlStatements(sql) {
  const statements = [];
  let statement = '';
  let state = 'normal';
  let dollarTag = '';
  let blockCommentDepth = 0;
  let escapeString = false;

  for (let index = 0; index < sql.length;) {
    const pair = sql.slice(index, index + 2);
    const character = sql[index];

    if (state === 'line-comment') {
      if (character === '\n') {
        state = 'normal';
        statement += ' ';
      }
      index += 1;
      continue;
    }
    if (state === 'block-comment') {
      if (pair === '/*') {
        blockCommentDepth += 1;
        index += 2;
      } else if (pair === '*/') {
        blockCommentDepth -= 1;
        index += 2;
        if (blockCommentDepth === 0) {
          state = 'normal';
          statement += ' ';
        }
      } else {
        index += 1;
      }
      continue;
    }
    if (state === 'single-quote') {
      if (escapeString && character === '\\') {
        index += Math.min(2, sql.length - index);
      } else if (pair === "''") {
        index += 2;
      } else if (character === "'") {
        state = 'normal';
        escapeString = false;
        index += 1;
      } else {
        index += 1;
      }
      continue;
    }
    if (state === 'double-quote') {
      if (pair === '""') {
        index += 2;
      } else if (character === '"') {
        state = 'normal';
        index += 1;
      } else {
        index += 1;
      }
      continue;
    }
    if (state === 'dollar-quote') {
      if (sql.startsWith(dollarTag, index)) {
        state = 'normal';
        index += dollarTag.length;
      } else {
        index += 1;
      }
      continue;
    }

    if (pair === '--') {
      state = 'line-comment';
      index += 2;
    } else if (pair === '/*') {
      state = 'block-comment';
      blockCommentDepth = 1;
      index += 2;
    } else if (character === "'") {
      state = 'single-quote';
      escapeString = /(?:^|[^A-Za-z0-9_$])e$/iu.test(statement);
      statement += ' ';
      index += 1;
    } else if (character === '"') {
      state = 'double-quote';
      statement += ' ';
      index += 1;
    } else if (character === '$') {
      const match = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u);
      if (match) {
        state = 'dollar-quote';
        dollarTag = match[0];
        statement += ' ';
        index += dollarTag.length;
      } else {
        statement += character;
        index += 1;
      }
    } else if (character === ';') {
      if (statement.trim()) statements.push(statement.trim());
      statement = '';
      index += 1;
    } else {
      statement += character;
      index += 1;
    }
  }

  assert.ok(['normal', 'line-comment'].includes(state), `unterminated SQL lexical state: ${state}`);
  if (statement.trim()) statements.push(statement.trim());
  return statements;
}

function findTransactionControl(sql) {
  return topLevelSqlStatements(sql).find((statement) =>
    /^(?:begin\b|start\s+transaction\b|commit\b|end\b|rollback\b|abort\b|savepoint\b|release\s+savepoint\b|prepare\s+transaction\b|set\s+(?:local\s+)?transaction\b|set\s+session\s+characteristics\s+as\s+transaction\b)/iu.test(statement),
  );
}

for (const unsafeSql of [
  'BEGIN;',
  'BEGIN TRANSACTION;',
  'START\nTRANSACTION;',
  'select 1; COMMIT WORK;',
  '/* lead */ ROLLBACK TO SAVEPOINT before_migration;',
  'select 1;\nSAVEPOINT nested;',
  'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;',
  'ABORT;',
  "select 'ordinary backslash \\'; COMMIT;",
]) {
  assert.ok(findTransactionControl(unsafeSql), `transaction-control fixture escaped: ${unsafeSql}`);
}
for (const safeSql of [
  'do $body$ begin perform 1; end $body$;',
  "select 'BEGIN; COMMIT;'; -- ROLLBACK;\nselect 1;",
  "select E'escaped quote \\'; COMMIT; remains string';",
  'select "rollback" from example;',
]) {
  assert.equal(findTransactionControl(safeSql), undefined, `safe SQL fixture misclassified: ${safeSql}`);
}

const embeddedTransactionControl = findTransactionControl(migration);
assert.equal(
  embeddedTransactionControl,
  undefined,
  `Supabase apply_migration supplies the transaction; found embedded control: ${embeddedTransactionControl}`,
);
const db = new PGlite();
const evidence = [];

function record(name, detail) {
  evidence.push({ name, detail });
}

async function query(sql, params = []) {
  return (await db.query(sql, params)).rows;
}

async function rpcWithEnvelope(role, {
  userId,
  operation,
  documentId,
  documentSchema = 'advertising-game-progress',
  schemaVersion = 1,
  expectedRevision,
  document,
}) {
  await db.exec(`set role ${role}`);
  try {
    const rows = await query(
      `select public.advertising_game_progress_rpc(
         $1::uuid, $2::text, $3::text, $4::text, $5::integer,
         $6::bigint, $7::jsonb
       ) as result`,
      [
        userId,
        operation,
        documentId,
        documentSchema,
        schemaVersion,
        expectedRevision,
        document == null ? null : JSON.stringify(document),
      ],
    );
    return rows[0].result;
  } finally {
    await db.exec('reset role');
  }
}

async function rpc(role, userId, operation, documentId, expectedRevision, document) {
  return rpcWithEnvelope(role, {
    userId,
    operation,
    documentId,
    expectedRevision,
    document,
  });
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

  let deliberateRollbackObserved = false;
  await db.exec('begin');
  try {
    await db.exec(migration);
    await db.exec('select 1 / 0');
    assert.fail('deliberate migration rollback probe did not fail');
  } catch (error) {
    deliberateRollbackObserved = /division by zero/iu.test(String(error.message ?? error));
    await db.exec('rollback');
  }
  assert.equal(deliberateRollbackObserved, true);
  const [afterRollback] = await query(`
    select
      to_regnamespace('advertising_game') is null as schema_absent,
      to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)') is null as rpc_absent,
      not exists (
        select 1 from pg_catalog.pg_roles
        where rolname = 'advertising_game_progress_owner_20260718'
      ) as owner_role_absent,
      (select payload from public.signal_lost where id = 7) as sentinel_payload
  `);
  assert.deepEqual(afterRollback, {
    schema_absent: true,
    rpc_absent: true,
    owner_role_absent: true,
    sentinel_payload: 'must-remain-untouched',
  });
  record('harness-owned-transaction-rollback', {
    deliberateFailure: 'division by zero after complete migration body',
    allTargetObjectsRolledBack: true,
    unrelatedSentinelUntouched: true,
  });

  await db.exec('begin');
  try {
    await db.exec(migration);
    await db.exec('commit');
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
  record('migration-execution', {
    migrationSha256,
    status: 'transaction-body executed inside harness-owned transaction',
    embeddedTransactionControl: false,
  });

  let collisionRejected = false;
  await db.exec('begin');
  try {
    await db.exec(migration);
    await db.exec('commit');
  } catch (error) {
    collisionRejected = /Advertising Game progress owner role collision/iu.test(String(error.message ?? error));
    await db.exec('rollback');
  }
  assert.equal(collisionRejected, true);
  const [afterCollision] = await query(`
    select
      to_regnamespace('advertising_game') is not null as schema_present,
      to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)') is not null as rpc_present,
      exists (
        select 1 from pg_catalog.pg_roles
        where rolname = 'advertising_game_progress_owner_20260718'
      ) as owner_role_present,
      (select payload from public.signal_lost where id = 7) as sentinel_payload
  `);
  assert.deepEqual(afterCollision, {
    schema_present: true,
    rpc_present: true,
    owner_role_present: true,
    sentinel_payload: 'must-remain-untouched',
  });
  record('second-application-collision-fails-closed', {
    rejectedAt: 'dedicated owner role collision preflight',
    committedTargetObjectsRemainPresent: true,
    unrelatedSentinelUntouched: true,
  });

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
      (select count(*) from pg_proc p where p.oid = to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)')) as exact_signature_count,
      (select count(*) from pg_class i join pg_namespace n on n.oid = i.relnamespace where n.nspname = 'advertising_game' and i.relname = 'advertising_game_progress_updated_at_idx' and i.relkind = 'i') as exact_index_count,
      (select pg_get_indexdef(i.oid) from pg_class i join pg_namespace n on n.oid = i.relnamespace where n.nspname = 'advertising_game' and i.relname = 'advertising_game_progress_updated_at_idx' and i.relkind = 'i') as index_definition
  `);
  assert.match(catalog.index_definition, /^CREATE INDEX advertising_game_progress_updated_at_idx ON advertising_game\.progress USING btree \(user_id, updated_at DESC\)$/u);
  assert.deepEqual({ ...catalog, index_definition: '<exact reviewed definition>' }, {
    schema_owner: 'advertising_game_progress_owner_20260718',
    table_owner: 'advertising_game_progress_owner_20260718',
    function_owner: 'advertising_game_progress_owner_20260718',
    named_rpc_count: 1,
    exact_signature_count: 1,
    exact_index_count: 1,
    index_definition: '<exact reviewed definition>',
  });
  record('exact-object-owners-signature-and-index', catalog);

  const [ownershipScope] = await query(`
    with dedicated_owner as (
      select r.oid
      from pg_roles r
      where r.rolname = 'advertising_game_progress_owner_20260718'
    ), target_table as (
      select c.oid, c.reltoastrelid
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'advertising_game'
        and c.relname = 'progress'
        and c.relkind = 'r'
    )
    select
      (select count(*) from pg_namespace n, dedicated_owner o where n.nspowner = o.oid and n.nspname <> 'advertising_game') as unexpected_owned_schemas,
      (
        select count(*)
        from pg_class c
        cross join dedicated_owner o
        cross join target_table t
        where c.relowner = o.oid
          and c.oid <> t.oid
          and c.oid <> t.reltoastrelid
          and not exists (
            select 1 from pg_index i
            where i.indexrelid = c.oid
              and i.indrelid in (t.oid, t.reltoastrelid)
          )
      ) as unexpected_owned_relations,
      (select count(*) from pg_class c, dedicated_owner o where c.relowner = o.oid) as exact_owned_relation_count,
      (
        select count(*)
        from pg_proc p
        cross join dedicated_owner o
        where p.proowner = o.oid
          and p.oid is distinct from to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)')
      ) as unexpected_owned_functions
  `);
  assert.deepEqual(ownershipScope, {
    unexpected_owned_schemas: 0,
    unexpected_owned_relations: 0,
    exact_owned_relation_count: 5,
    unexpected_owned_functions: 0,
  });
  record('exact-owner-scope-including-dependent-toast', ownershipScope);

  const [access] = await query(`
    select c.relrowsecurity as rls_enabled,
           (select count(*) from pg_policies where schemaname = 'advertising_game' and tablename = 'progress') as direct_policy_count,
           has_schema_privilege('anon', n.oid, 'USAGE') as anon_schema_usage,
           has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_schema_usage,
           has_schema_privilege('service_role', n.oid, 'USAGE') as service_schema_usage,
           has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as anon_table_dml,
           has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as authenticated_table_dml,
           has_table_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as service_table_dml,
           has_schema_privilege('advertising_game_progress_owner_20260718', 'public', 'CREATE') as owner_public_create,
           p.prosecdef as security_definer,
           p.proconfig::text as function_settings,
           p.proconfig = array['search_path=""']::text[] as exact_empty_search_path,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join pg_proc p
    where n.nspname = 'advertising_game' and c.relname = 'progress'
      and p.oid = to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)')
  `);
  assert.equal(access.function_settings, '{"search_path=\\"\\""}');
  assert.deepEqual(access, {
    rls_enabled: true, direct_policy_count: 0,
    anon_schema_usage: false, authenticated_schema_usage: false, service_schema_usage: false,
    anon_table_dml: false, authenticated_table_dml: false, service_table_dml: false,
    owner_public_create: false,
    security_definer: true, function_settings: '{"search_path=\\"\\""}',
    exact_empty_search_path: true,
    anon_can_execute: false, authenticated_can_execute: false, service_role_can_execute: true,
  });
  record('rls-direct-grants-and-function-grant', access);

  const [compiledRpc] = await query(`
    select pg_get_functiondef(
      to_regprocedure('public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)')
    ) as definition
  `);
  const compiledDefinition = compiledRpc.definition.toLowerCase();
  const lockNeedle = 'pg_catalog.pg_advisory_xact_lock';
  const lockOffset = compiledDefinition.indexOf(lockNeedle);
  const revisionLookupOffset = compiledDefinition.indexOf('select progress.revision', lockOffset);
  const documentCountOffset = compiledDefinition.indexOf('select pg_catalog.count(*)::integer', lockOffset);
  const insertOffset = compiledDefinition.indexOf('insert into advertising_game.progress', lockOffset);
  const updateOffset = compiledDefinition.indexOf('update advertising_game.progress', lockOffset);
  const lockOccurrences = compiledDefinition.split(lockNeedle).length - 1;
  assert.equal(lockOccurrences, 1);
  assert.ok(lockOffset >= 0);
  for (const [name, offset] of Object.entries({
    revisionLookupOffset,
    documentCountOffset,
    insertOffset,
    updateOffset,
  })) {
    assert.ok(offset > lockOffset, `${name} must follow the per-account advisory lock`);
  }
  record('compiled-per-account-write-serialization-structure', {
    advisoryXactLockOccurrences: lockOccurrences,
    lockBeforeRevisionLookup: lockOffset < revisionLookupOffset,
    lockBeforeDocumentCount: lockOffset < documentCountOffset,
    lockBeforeInsert: lockOffset < insertOffset,
    lockBeforeUpdate: lockOffset < updateOffset,
    limitation: 'PGlite is single-connection; live inter-session scheduling is not simulated here',
  });

  const userOne = '11111111-1111-1111-1111-111111111111';
  const userTwo = '22222222-2222-2222-2222-222222222222';
  assert.deepEqual(await rpc('service_role', userOne, 'list', null, null, null), { status: 'listed', documents: [] });
  assert.deepEqual(await rpc('service_role', userOne, 'load', 'alpha', null, null), { status: 'not_found' });
  assert.equal((await rpc('service_role', userOne, 'save', 'alpha', 0, documentFor('alpha'))).status, 'saved');
  const loaded = await rpc('service_role', userOne, 'load', 'alpha', null, null);
  assert.equal(loaded.status, 'found');
  assert.equal(loaded.document.teamId, 'team-1');
  assert.equal((await rpc('service_role', userOne, 'save', 'alpha', 1, documentFor('alpha', 1))).revision, 2);
  assert.deepEqual(await rpc('service_role', userOne, 'save', 'alpha', 1, documentFor('alpha', 1)), { status: 'conflict', currentRevision: 2 });
  const alphaList = await rpc('service_role', userOne, 'list', null, null, null);
  assert.equal(alphaList.status, 'listed');
  assert.equal(alphaList.documents.length, 1);
  assert.deepEqual(Object.keys(alphaList.documents[0]).sort(), ['documentId', 'revision', 'updatedAt']);
  assert.equal('document' in alphaList.documents[0], false);
  record('list-load-save-cas-conflict', { listMetadataOnly: true, loaded: true, firstRevision: 1, secondRevision: 2, staleWrite: 'conflict/currentRevision=2' });

  const missingTeam = documentFor('missing-team');
  delete missingTeam.teamId;
  await expectError('missing-teamId-rejected', () => rpc('service_role', userOne, 'save', 'missing-team', 0, missingTeam), /invalid document identity/);
  await expectError('empty-teamId-rejected', () => rpc('service_role', userOne, 'save', 'empty-team', 0, documentFor('empty-team', 0, '')), /invalid document identity/);

  await expectError('null-user-rejected', () => rpc('service_role', null, 'list', null, null, null), /invalid user/);
  await expectError('invalid-operation-rejected', () => rpc('service_role', userOne, 'delete', null, null, null), /invalid operation/);
  await expectError('invalid-envelope-schema-rejected', () => rpcWithEnvelope('service_role', {
    userId: userOne, operation: 'list', documentId: null, documentSchema: 'wrong-schema', schemaVersion: 1,
    expectedRevision: null, document: null,
  }), /invalid schema/);
  await expectError('invalid-envelope-version-rejected', () => rpcWithEnvelope('service_role', {
    userId: userOne, operation: 'list', documentId: null, schemaVersion: 2,
    expectedRevision: null, document: null,
  }), /invalid schema/);
  await expectError('invalid-list-envelope-rejected', () => rpc('service_role', userOne, 'list', 'alpha', null, null), /invalid list request/);
  await expectError('invalid-document-id-rejected', () => rpc('service_role', userOne, 'load', 'UPPERCASE', null, null), /invalid document id/);
  await expectError('null-expected-revision-rejected', () => rpc('service_role', userOne, 'save', 'null-expected', null, documentFor('null-expected')), /invalid expected revision/);
  await expectError('negative-expected-revision-rejected', () => rpc('service_role', userOne, 'save', 'negative-expected', -1, documentFor('negative-expected')), /invalid expected revision/);
  await expectError('null-document-rejected', () => rpc('service_role', userOne, 'save', 'null-document', 0, null), /invalid document/);
  await expectError('array-document-rejected', () => rpc('service_role', userOne, 'save', 'array-document', 0, []), /invalid document/);

  const mismatchedDocumentId = documentFor('inside-id');
  await expectError('mismatched-documentId-rejected', () => rpc('service_role', userOne, 'save', 'outside-id', 0, mismatchedDocumentId), /invalid document identity/);
  const nonStringDocumentId = documentFor('non-string-document-id');
  nonStringDocumentId.documentId = 42;
  await expectError('non-string-documentId-rejected', () => rpc('service_role', userOne, 'save', 'non-string-document-id', 0, nonStringDocumentId), /invalid document identity/);
  const wrongDocumentSchemaVersion = documentFor('wrong-document-version');
  wrongDocumentSchemaVersion.schemaVersion = 2;
  await expectError('wrong-document-schemaVersion-rejected', () => rpc('service_role', userOne, 'save', 'wrong-document-version', 0, wrongDocumentSchemaVersion), /invalid document identity/);
  const wrongMode = documentFor('wrong-mode');
  wrongMode.mode = 'room';
  await expectError('wrong-document-mode-rejected', () => rpc('service_role', userOne, 'save', 'wrong-mode', 0, wrongMode), /invalid document identity/);
  const missingMode = documentFor('missing-mode');
  delete missingMode.mode;
  await expectError('missing-document-mode-rejected', () => rpc('service_role', userOne, 'save', 'missing-mode', 0, missingMode), /invalid document identity/);
  const nonStringTeamId = documentFor('non-string-team-id');
  nonStringTeamId.teamId = 42;
  await expectError('non-string-teamId-rejected', () => rpc('service_role', userOne, 'save', 'non-string-team-id', 0, nonStringTeamId), /invalid document identity/);
  const roomBound = documentFor('room-bound');
  roomBound.roomId = 'classroom-room';
  await expectError('room-bound-document-rejected', () => rpc('service_role', userOne, 'save', 'room-bound', 0, roomBound), /invalid document identity/);

  const missingDocumentRevision = documentFor('missing-document-revision');
  delete missingDocumentRevision.revision;
  await expectError('missing-document-revision-rejected', () => rpc('service_role', userOne, 'save', 'missing-document-revision', 0, missingDocumentRevision), /invalid document revision/);
  const stringDocumentRevision = documentFor('string-document-revision');
  stringDocumentRevision.revision = '0';
  await expectError('string-document-revision-rejected', () => rpc('service_role', userOne, 'save', 'string-document-revision', 0, stringDocumentRevision), /invalid document revision/);
  await expectError('negative-document-revision-rejected', () => rpc('service_role', userOne, 'save', 'negative-document-revision', 0, documentFor('negative-document-revision', -1)), /invalid document revision/);
  await expectError('fractional-document-revision-rejected', () => rpc('service_role', userOne, 'save', 'fractional-document-revision', 0, documentFor('fractional-document-revision', 0.5)), /invalid document revision/);
  await expectError('unsafe-integer-document-revision-rejected', () => rpc('service_role', userOne, 'save', 'unsafe-document-revision', 0, documentFor('unsafe-document-revision', 9007199254740992)), /invalid document revision/);
  const oversizedDocument = documentFor('oversized-document');
  oversizedDocument.campaign = { payload: 'x'.repeat(263000) };
  await expectError('oversized-document-rejected', () => rpc('service_role', userOne, 'save', 'oversized-document', 0, oversizedDocument), /document too large/);
  record('complete-request-and-document-validation', {
    operationSchemaAndListEnvelope: 'rejected when invalid',
    documentIdAndExpectedRevision: 'rejected when invalid',
    documentIdentity: 'schemaVersion/documentId/mode/teamId/roomId all exercised',
    documentRevision: 'type/range/integer bounds all exercised',
    documentSizeBound: 'exercised',
  });

  assert.equal((await rpc('service_role', userTwo, 'save', 'other-user', 0, documentFor('other-user'))).status, 'saved');
  assert.deepEqual(await rpc('service_role', userOne, 'load', 'other-user', null, null), { status: 'not_found' });
  record('account-isolation', { userOneLoadsOtherUserDocument: 'not_found' });

  const additionalDocumentIds = ['bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa'];
  for (const id of additionalDocumentIds) {
    assert.equal((await rpc('service_role', userOne, 'save', id, 0, documentFor(id))).status, 'saved');
  }
  assert.deepEqual(await rpc('service_role', userOne, 'save', 'quebec', 0, documentFor('quebec')), { status: 'document_limit' });
  const [{ storedCount }] = await query('select count(*)::integer as "storedCount" from advertising_game.progress where user_id = $1::uuid', [userOne]);
  assert.equal(storedCount, 16);
  await query(
    "update advertising_game.progress set updated_at = '2099-01-01T00:00:00Z'::timestamptz where user_id = $1::uuid",
    [userOne],
  );
  const cappedList = await rpc('service_role', userOne, 'list', null, null, null);
  const expectedOrder = ['alpha', ...additionalDocumentIds].sort();
  assert.equal(cappedList.documents.length, 16);
  assert.deepEqual(cappedList.documents.map((entry) => entry.documentId), expectedOrder);
  assert.equal(cappedList.documents.every((entry) => Object.keys(entry).sort().join(',') === 'documentId,revision,updatedAt'), true);
  record('document-cap-list-order-and-bounds', { savedDistinctDocuments: 16, seventeenth: 'document_limit', storedCount, listedCount: cappedList.documents.length, deliberatelyTiedTimestamps: 16, orderMatchesAsciiDocumentId: true, metadataOnly: true });

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
    status: 'PASS',
    pgliteVersion: '0.3.16',
    migrationSha256,
    checks: evidence,
  }, null, 2));
} finally {
  await db.close();
}
