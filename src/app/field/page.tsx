'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ENTERPRISE_USER_ID,
  FIELD_WORKER_ID,
  ORGANIZATION_ID,
} from '@/lib/identity';

type QcCase = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

type Assignment = {
  id: string;
  qc_case_id: string;
  status: string;
  created_at: string;
};

async function errorFromResponse(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body === 'object' && 'error' in body) {
      return String((body as { error: unknown }).error);
    }
  } catch {
    // ignore JSON parse errors
  }
  return res.statusText || `Request failed (${res.status})`;
}

export default function FieldPage() {
  const [openCases, setOpenCases] = useState<QcCase[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const fetchOpenCases = useCallback(async () => {
    setCasesError(null);
    try {
      const params = new URLSearchParams({
        organization_id: ORGANIZATION_ID,
        status: 'open',
      });
      const res = await fetch(`/api/qc-cases?${params}`);
      if (!res.ok) {
        setOpenCases([]);
        setCasesError(await errorFromResponse(res));
        return;
      }
      setOpenCases((await res.json()) as QcCase[]);
    } catch (err) {
      setOpenCases([]);
      setCasesError(err instanceof Error ? err.message : 'Failed to load cases');
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setAssignmentsError(null);
    try {
      const params = new URLSearchParams({
        organization_id: ORGANIZATION_ID,
        assigned_to: FIELD_WORKER_ID,
      });
      const res = await fetch(`/api/assignments?${params}`);
      if (!res.ok) {
        setAssignments([]);
        setAssignmentsError(await errorFromResponse(res));
        return;
      }
      setAssignments((await res.json()) as Assignment[]);
    } catch (err) {
      setAssignments([]);
      setAssignmentsError(
        err instanceof Error ? err.message : 'Failed to load assignments',
      );
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchOpenCases(), fetchAssignments()]);
    setLoading(false);
  }, [fetchOpenCases, fetchAssignments]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAccept(qcCaseId: string) {
    setAcceptError(null);
    setAcceptingId(qcCaseId);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: ORGANIZATION_ID,
          qc_case_id: qcCaseId,
          assigned_to: FIELD_WORKER_ID,
          assigned_by: ENTERPRISE_USER_ID,
        }),
      });
      if (!res.ok) {
        setAcceptError(await errorFromResponse(res));
        return;
      }
      const created = (await res.json()) as Assignment;
      const patchRes = await fetch(`/api/assignments/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      if (!patchRes.ok) {
        setAcceptError(await errorFromResponse(patchRes));
        return;
      }
      await refresh();
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to accept case');
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '640px' }}>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>Field Worker View</h1>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Available Cases</h2>
        {casesError && (
          <p role="alert" style={{ color: '#b00020' }}>
            {casesError}
          </p>
        )}
        {loading && !casesError && <p>Loading…</p>}
        {!loading && !casesError && openCases.length === 0 && <p>No open cases.</p>}
        {!casesError && openCases.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
            {openCases.map((c) => (
              <li
                key={c.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div>
                  <strong>{c.title}</strong>
                  {c.description && <p style={{ margin: '0.25rem 0 0' }}>{c.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleAccept(c.id)}
                  disabled={acceptingId === c.id}
                  style={{ padding: '0.5rem 1rem', flexShrink: 0 }}
                >
                  {acceptingId === c.id ? 'Accepting…' : 'Accept'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {acceptError && (
          <p role="alert" style={{ color: '#b00020', marginTop: '0.75rem' }}>
            {acceptError}
          </p>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>My Assignments</h2>
        {assignmentsError && (
          <p role="alert" style={{ color: '#b00020' }}>
            {assignmentsError}
          </p>
        )}
        {loading && !assignmentsError && <p>Loading…</p>}
        {!loading && !assignmentsError && assignments.length === 0 && (
          <p>No assignments yet.</p>
        )}
        {!assignmentsError && assignments.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
            {assignments.map((a) => (
              <li
                key={a.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                Case: {a.qc_case_id}
                <span style={{ marginLeft: '0.5rem', color: '#666' }}>({a.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
