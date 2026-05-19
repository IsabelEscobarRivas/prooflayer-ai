# Phase 1 — manual SQL smoke test

Apply `supabase/migrations/001_foundation.sql` on a **new** Supabase project. ADR-001: **no seeds** — create test data via SQL or API.

## 1. Schema verification

```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'prooflayer';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'prooflayer' ORDER BY table_name;
-- Expect: assignments, organizations, qc_cases, users

SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('organizations', 'users', 'qc_cases', 'assignments');
-- Expect: zero rows
```

## 2. Fixture (replace UUIDs after creating auth users)

```sql
-- After creating matching rows in auth.users:
INSERT INTO prooflayer.organizations (id, name, slug)
VALUES ('00000000-0000-4000-8000-000000000001', 'ProofLayer Demo', 'prooflayer-demo');

INSERT INTO prooflayer.users (id, organization_id, email, full_name, role)
VALUES
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'alex@prooflayer.ai', 'Alex Chen', 'enterprise'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-000000000001', 'jordan@prooflayer.ai', 'Jordan Rivera', 'field_worker');
```

## 3. Case + assignment flow

```sql
INSERT INTO prooflayer.qc_cases (organization_id, title, status, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Smoke test case',
  'open',
  '11111111-1111-4111-8111-111111111111'
)
RETURNING id;

-- Use returned case id:
INSERT INTO prooflayer.assignments (organization_id, qc_case_id, assigned_to, assigned_by, status)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '<case_id>',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'in_progress'
);

SELECT * FROM prooflayer.assignments WHERE qc_case_id = '<case_id>';
```

## 4. Org consistency (must fail)

```sql
-- Expect error: assignment_organization_mismatch
INSERT INTO prooflayer.assignments (organization_id, qc_case_id, assigned_to, assigned_by)
VALUES (
  '00000000-0000-4000-8000-000000000099',
  '<case_id>',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111'
);
```
