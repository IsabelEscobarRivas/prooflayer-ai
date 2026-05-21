'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ENTERPRISE_USER_ID,
  FIELD_WORKER_ID,
  ORGANIZATION_ID,
} from '@/lib/identity';

const NAVY = '#1B2D4F';
const BLUE = '#2E6DA4';

type QcCase = {
  id: string;
  title: string;
  instructions: string | null;
  store_name: string | null;
  store_address: string | null;
  item_name: string | null;
  barcode_sku: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  status: string;
};

type Template = {
  id: string;
  kind: string;
  label: string;
  instructions: string | null;
  is_mandatory?: boolean;
};

type Assignment = {
  id: string;
  qc_case_id: string;
  status: string;
  submitted_at: string | null;
  accepted_at: string | null;
};

type Requirement = {
  id: string;
  label: string;
  kind: string;
  is_mandatory: boolean;
  status: string;
  instructions: string | null;
};

async function errorFromResponse(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body === 'object' && 'error' in body) {
      return String((body as { error: unknown }).error);
    }
  } catch {
    // ignore
  }
  return res.statusText || `Request failed (${res.status})`;
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    draft: { bg: '#e2e8f0', color: '#475569' },
    open: { bg: '#dbeafe', color: '#1d4ed8' },
    in_review: { bg: '#fef3c7', color: '#b45309' },
    closed: { bg: '#d1fae5', color: '#047857' },
    pending: { bg: '#e2e8f0', color: '#475569' },
    in_progress: { bg: '#dbeafe', color: '#1d4ed8' },
    submitted: { bg: '#fef3c7', color: '#b45309' },
    approved: { bg: '#d1fae5', color: '#047857' },
    rejected: { bg: '#fee2e2', color: '#b91c1c' },
  };
  const s = map[status] ?? { bg: '#e2e8f0', color: '#475569' };
  return {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: s.bg,
    color: s.color,
  };
}

function formatWindow(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const fmt = (v: string) => new Date(v).toLocaleString();
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return start ? fmt(start) : end ? fmt(end) : '—';
}

export default function FieldPage() {
  const [openCases, setOpenCases] = useState<QcCase[]>([]);
  const [templatesByCase, setTemplatesByCase] = useState<Record<string, Template[]>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [casesById, setCasesById] = useState<Record<string, QcCase>>({});
  const [requirementsByAssignment, setRequirementsByAssignment] = useState<
    Record<string, Requirement[]>
  >({});
  const [notesByAssignment, setNotesByAssignment] = useState<Record<string, string>>({});

  const [casesError, setCasesError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchOpenCases = useCallback(async () => {
    setLoadingCases(true);
    setCasesError(null);
    try {
      const params = new URLSearchParams({
        organization_id: ORGANIZATION_ID,
        available: 'true',
        status: 'open',
      });
      const res = await fetch(`/api/qc-cases?${params}`);
      if (!res.ok) {
        setOpenCases([]);
        setTemplatesByCase({});
        setCasesError(await errorFromResponse(res));
        return;
      }
      const cases = (await res.json()) as QcCase[];
      setOpenCases(cases);

      const templateMap: Record<string, Template[]> = {};
      for (const c of cases) {
        const tRes = await fetch(
          `/api/qc-cases/${c.id}/templates?organization_id=${encodeURIComponent(ORGANIZATION_ID)}`,
        );
        if (tRes.ok) {
          templateMap[c.id] = (await tRes.json()) as Template[];
        } else {
          templateMap[c.id] = [];
        }
      }
      setTemplatesByCase(templateMap);
    } catch (err) {
      setOpenCases([]);
      setTemplatesByCase({});
      setCasesError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      const params = new URLSearchParams({
        organization_id: ORGANIZATION_ID,
        assigned_to: FIELD_WORKER_ID,
      });
      const res = await fetch(`/api/assignments?${params}`);
      if (!res.ok) {
        setAssignments([]);
        setCasesById({});
        setRequirementsByAssignment({});
        setAssignmentsError(await errorFromResponse(res));
        return;
      }
      const assigns = (await res.json()) as Assignment[];
      setAssignments(assigns);

      const caseMap: Record<string, QcCase> = {};
      const reqMap: Record<string, Requirement[]> = {};

      for (const a of assigns) {
        if (!caseMap[a.qc_case_id]) {
          const caseRes = await fetch(`/api/qc-cases/${a.qc_case_id}`);
          if (caseRes.ok) {
            caseMap[a.qc_case_id] = (await caseRes.json()) as QcCase;
          }
        }
        if (a.status === 'in_progress') {
          const reqRes = await fetch(`/api/assignments/${a.id}/requirements`);
          if (reqRes.ok) {
            reqMap[a.id] = (await reqRes.json()) as Requirement[];
          } else {
            reqMap[a.id] = [];
          }
        }
      }
      setCasesById(caseMap);
      setRequirementsByAssignment(reqMap);
    } catch (err) {
      setAssignments([]);
      setCasesById({});
      setRequirementsByAssignment({});
      setAssignmentsError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchOpenCases(), fetchAssignments()]);
  }, [fetchOpenCases, fetchAssignments]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAccept(qcCaseId: string) {
    setActionError(null);
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
        setActionError(await errorFromResponse(res));
        return;
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept case');
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleSubmit(assignmentId: string) {
    setActionError(null);
    setSubmittingId(assignmentId);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: ORGANIZATION_ID,
          assignment_id: assignmentId,
          submitted_by: FIELD_WORKER_ID,
          notes: notesByAssignment[assignmentId]?.trim() || null,
        }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header
        style={{
          background: NAVY,
          color: '#fff',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <strong style={{ fontSize: '1.1rem' }}>ProofLayer AI</strong>
          <span style={{ marginLeft: '1rem', opacity: 0.85, fontSize: '0.9rem' }}>
            Field Worker
          </span>
        </div>
        <Link href="/" style={{ color: '#93c5fd', fontSize: '0.9rem' }}>
          Sign out
        </Link>
      </header>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 2rem 3rem' }}>
        {actionError && <p style={errorStyle}>{actionError}</p>}

        <section style={cardStyle}>
          <h2 style={sectionTitle}>Available Cases</h2>
          {casesError && <p style={errorStyle}>{casesError}</p>}
          {loadingCases && !casesError && <p>Loading...</p>}
          {!loadingCases && !casesError && openCases.length === 0 && (
            <p>No open cases available.</p>
          )}
          {openCases.map((c) => (
            <div key={c.id} style={innerCardStyle}>
              <strong style={{ fontSize: '1.05rem', color: NAVY }}>{c.title}</strong>
              <p style={{ margin: '0.35rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                {[c.store_name, c.store_address].filter(Boolean).join(' · ') || '—'}
              </p>
              <p style={{ margin: '0 0 0.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                {[c.item_name, c.barcode_sku].filter(Boolean).join(' · ') || '—'}
              </p>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                {formatWindow(c.time_window_start, c.time_window_end)}
              </p>
              {c.instructions && (
                <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
                  <strong>Brief:</strong> {c.instructions}
                </p>
              )}
              <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0.25rem' }}>
                <strong>Evidence required:</strong>
              </p>
              {(templatesByCase[c.id] ?? []).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>None listed</p>
              ) : (
                <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {(templatesByCase[c.id] ?? []).map((t) => (
                    <li key={t.id}>
                      <span style={statusBadgeStyle(t.kind)}>{t.kind}</span> {t.label}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => handleAccept(c.id)}
                disabled={acceptingId === c.id}
                style={{ ...primaryBtn(BLUE), marginTop: '0.75rem' }}
              >
                {acceptingId === c.id ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          ))}
        </section>

        <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
          <h2 style={sectionTitle}>My Active Assignments</h2>
          {assignmentsError && <p style={errorStyle}>{assignmentsError}</p>}
          {loadingAssignments && !assignmentsError && <p>Loading...</p>}
          {!loadingAssignments && !assignmentsError && assignments.length === 0 && (
            <p>No assignments yet.</p>
          )}
          {assignments.map((a) => {
            const qc = casesById[a.qc_case_id];
            const reqs = requirementsByAssignment[a.id] ?? [];
            return (
              <div key={a.id} style={innerCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong style={{ color: NAVY }}>{qc?.title ?? a.qc_case_id}</strong>
                  <span style={statusBadgeStyle(a.status)}>{a.status}</span>
                </div>
                {qc && (
                  <>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.9rem', color: '#64748b' }}>
                      {[qc.store_name, qc.store_address].filter(Boolean).join(' · ')}
                    </p>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                      {[qc.item_name, qc.barcode_sku].filter(Boolean).join(' · ')}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {formatWindow(qc.time_window_start, qc.time_window_end)}
                    </p>
                  </>
                )}

                {a.status === 'in_progress' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    {qc?.instructions && (
                      <p style={{ fontSize: '0.9rem' }}>
                        <strong>Instructions:</strong> {qc.instructions}
                      </p>
                    )}
                    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      <strong>Evidence checklist</strong>
                    </p>
                    {reqs.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No requirements</p>
                    ) : (
                      <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '0.5rem 0' }}>
                        {reqs.map((r) => (
                          <li
                            key={r.id}
                            style={{
                              padding: '0.5rem',
                              background: '#f8fafc',
                              borderRadius: '6px',
                              marginBottom: '0.35rem',
                              fontSize: '0.85rem',
                            }}
                          >
                            <span style={statusBadgeStyle(r.kind)}>{r.kind}</span>{' '}
                            <strong>{r.label}</strong>
                            {r.is_mandatory && (
                              <span style={{ color: '#b45309', marginLeft: '0.35rem' }}>*</span>
                            )}{' '}
                            <span style={statusBadgeStyle(r.status)}>{r.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <label style={labelStyle}>
                      Submission notes
                      <textarea
                        value={notesByAssignment[a.id] ?? ''}
                        onChange={(e) =>
                          setNotesByAssignment((prev) => ({
                            ...prev,
                            [a.id]: e.target.value,
                          }))
                        }
                        rows={2}
                        style={inputStyle}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSubmit(a.id)}
                      disabled={submittingId === a.id}
                      style={{ ...primaryBtn(NAVY), marginTop: '0.5rem' }}
                    >
                      {submittingId === a.id ? 'Submitting…' : 'Submit for Review'}
                    </button>
                  </div>
                )}

                {a.status === 'submitted' && (
                  <p style={{ marginTop: '0.75rem', color: '#b45309', fontWeight: 600 }}>
                    Submitted — awaiting review
                  </p>
                )}

                {a.status === 'approved' && (
                  <p style={{ marginTop: '0.75rem', color: '#047857', fontWeight: 600 }}>
                    Approved — work complete
                  </p>
                )}

                {a.status === 'rejected' && (
                  <p style={{ marginTop: '0.75rem', color: '#b91c1c' }}>
                    Rejected — check Available Cases above to accept a new assignment
                  </p>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: NAVY,
  marginTop: '0.75rem',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.35rem',
  padding: '0.55rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 2px 8px rgba(27, 45, 79, 0.06)',
  padding: '1.25rem 1.5rem',
};

const innerCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
  marginBottom: '0.75rem',
  boxShadow: '0 1px 4px rgba(27, 45, 79, 0.04)',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1.15rem',
  color: NAVY,
};

const errorStyle: React.CSSProperties = { color: '#b91c1c', marginBottom: '0.75rem' };

function primaryBtn(bg: string): React.CSSProperties {
  return {
    padding: '0.55rem 1rem',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
  };
}
