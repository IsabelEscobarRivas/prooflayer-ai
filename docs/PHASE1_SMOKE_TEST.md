# Phase 1 — SQL smoke test (mandatory)

Run in Supabase SQL Editor after applying `supabase/migrations/001_foundation.sql`.

## Seed

```sql
SELECT id, slug FROM organizations;
SELECT id, email, role FROM users ORDER BY role;
```

## After create + accept (replace `<case_id>`)

```sql
SELECT id, status, created_by FROM qc_cases WHERE id = '<case_id>';
SELECT * FROM assignments WHERE case_id = '<case_id>';
SELECT status FROM qc_cases WHERE id = '<case_id>';  -- expect active
```

## Available vs assigned

```sql
-- Should include case before accept:
SELECT c.id FROM qc_cases c
WHERE c.status = 'open'
  AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.case_id = c.id);

-- Should exclude case after accept:
SELECT a.id, c.title FROM assignments a
JOIN qc_cases c ON c.id = a.case_id
WHERE a.worker_id = 'user_jordan_002';
```
