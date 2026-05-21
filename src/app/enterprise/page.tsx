'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ENTERPRISE_USER_ID,
  ORGANIZATION_ID,
} from '@/lib/identity';

const NAVY = '#1B2D4F';
const BLUE = '#2E6DA4';

type QcCase = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  store_name: string | null;
  store_address: string | null;
  item_name: string | null;
  barcode_sku: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  status: string;
  created_at: string;
};

type Assignment = {
  id: string;
  qc_case_id: string;
  assigned_to: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
};

type Template = {
  id: string;
  kind: string;
  label: string;
  instructions: string | null;
  min_count?: number;
  is_mandatory?: boolean;
};

type DraftRequirement = {
  tempId: string;
  kind: string;
  label: string;
  instructions: string;
};

type AssignmentEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  actor_id: string;
  reason: string | null;
  created_at: string;
};

type AssignmentRequirement = {
  id: string;
  label: string;
  kind: string;
  is_mandatory: boolean;
  status: string;
};

const CASE_STATUSES = ['all', 'draft', 'open', 'in_review', 'closed'] as const;

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

export default function EnterprisePage() {
  const [title, setTitle] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [itemName, setItemName] = useState('');
  const [barcodeSku, setBarcodeSku] = useState('');
  const [timeWindowStart, setTimeWindowStart] = useState('');
  const [timeWindowEnd, setTimeWindowEnd] = useState('');
  const [instructions, setInstructions] = useState('');
  const [draftRequirements, setDraftRequirements] = useState<DraftRequirement[]>([]);
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqKind, setReqKind] = useState('photo');
  const [reqLabel, setReqLabel] = useState('');
  const [reqInstructions, setReqInstructions] = useState('');

  const [cases, setCases] = useState<QcCase[]>([]);
  const [assignmentsByCase, setAssignmentsByCase] = useState<Record<string, Assignment[]>>({});
  const [caseFilter, setCaseFilter] = useState<(typeof CASE_STATUSES)[number]>('all');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Template[]>([]);

  const [reviewAssignments, setReviewAssignments] = useState<Assignment[]>([]);
  const [reviewCases, setReviewCases] = useState<Record<string, QcCase>>({});
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [reviewEvents, setReviewEvents] = useState<AssignmentEvent[]>([]);
  const [reviewRequirements, setReviewRequirements] = useState<AssignmentRequirement[]>([]);
  const [rejectReason, setRejectReason] = useState('');

  const [listError, setListError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingReview, setLoadingReview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoadingCases(true);
    setListError(null);
    try {
      const res = await fetch(
        `/api/qc-cases?organization_id=${encodeURIComponent(ORGANIZATION_ID)}`,
      );
      if (!res.ok) {
        setCases([]);
        setListError(await errorFromResponse(res));
        return;
      }
      const data = (await res.json()) as QcCase[];
      setCases(data);

      const assignRes = await fetch(
        `/api/assignments?organization_id=${encodeURIComponent(ORGANIZATION_ID)}`,
      );
      if (assignRes.ok) {
        const assigns = (await assignRes.json()) as Assignment[];
        const byCase: Record<string, Assignment[]> = {};
        for (const a of assigns) {
          if (!byCase[a.qc_case_id]) byCase[a.qc_case_id] = [];
          byCase[a.qc_case_id].push(a);
        }
        setAssignmentsByCase(byCase);
      }
    } catch (err) {
      setCases([]);
      setListError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const fetchReview = useCallback(async () => {
    setLoadingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(
        `/api/assignments?organization_id=${encodeURIComponent(ORGANIZATION_ID)}&status=submitted`,
      );
      if (!res.ok) {
        setReviewAssignments([]);
        setReviewError(await errorFromResponse(res));
        return;
      }
      const assigns = (await res.json()) as Assignment[];
      setReviewAssignments(assigns);

      const caseMap: Record<string, QcCase> = {};
      for (const a of assigns) {
        if (caseMap[a.qc_case_id]) continue;
        const caseRes = await fetch(`/api/qc-cases/${a.qc_case_id}`);
        if (caseRes.ok) {
          caseMap[a.qc_case_id] = (await caseRes.json()) as QcCase;
        }
      }
      setReviewCases(caseMap);
    } catch (err) {
      setReviewAssignments([]);
      setReviewError(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoadingReview(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    fetchReview();
  }, [fetchCases, fetchReview]);

  const filteredCases =
    caseFilter === 'all' ? cases : cases.filter((c) => c.status === caseFilter);

  function addDraftRequirement() {
    if (!reqLabel.trim()) return;
    setDraftRequirements((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        kind: reqKind,
        label: reqLabel.trim(),
        instructions: reqInstructions.trim(),
      },
    ]);
    setReqLabel('');
    setReqInstructions('');
    setShowReqForm(false);
  }

  async function saveCase(publish: boolean) {
    setFormError(null);
    setSaving(true);
    try {
      if (!title.trim()) {
        setFormError('Title is required');
        return;
      }
      if (publish && draftRequirements.length === 0) {
        setFormError('At least one evidence requirement is required to publish');
        return;
      }

      const caseRes = await fetch('/api/qc-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: ORGANIZATION_ID,
          title: title.trim(),
          description: itemName.trim() || null,
          instructions: instructions.trim() || null,
          store_name: storeName.trim() || null,
          store_address: storeAddress.trim() || null,
          item_name: itemName.trim() || null,
          barcode_sku: barcodeSku.trim() || null,
          time_window_start: timeWindowStart || null,
          time_window_end: timeWindowEnd || null,
          status: 'draft',
          created_by: ENTERPRISE_USER_ID,
        }),
      });
      if (!caseRes.ok) {
        setFormError(await errorFromResponse(caseRes));
        return;
      }
      const qcCase = (await caseRes.json()) as QcCase;

      for (const req of draftRequirements) {
        const tRes = await fetch(`/api/qc-cases/${qcCase.id}/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: req.kind,
            label: req.label,
            instructions: req.instructions || null,
            created_by: ENTERPRISE_USER_ID,
          }),
        });
        if (!tRes.ok) {
          setFormError(await errorFromResponse(tRes));
          return;
        }
      }

      if (publish) {
        const pubRes = await fetch(`/api/qc-cases/${qcCase.id}/publish`, { method: 'POST' });
        if (!pubRes.ok) {
          setFormError(await errorFromResponse(pubRes));
          return;
        }
      }

      setTitle('');
      setStoreName('');
      setStoreAddress('');
      setItemName('');
      setBarcodeSku('');
      setTimeWindowStart('');
      setTimeWindowEnd('');
      setInstructions('');
      setDraftRequirements([]);
      await fetchCases();
      setExpandedCaseId(qcCase.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save case');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCaseExpand(caseId: string) {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      setExpandedTemplates([]);
      return;
    }
    setExpandedCaseId(caseId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/qc-cases/${caseId}/templates?organization_id=${encodeURIComponent(ORGANIZATION_ID)}`,
      );
      if (!res.ok) {
        setExpandedTemplates([]);
        setActionError(await errorFromResponse(res));
        return;
      }
      setExpandedTemplates((await res.json()) as Template[]);
    } catch (err) {
      setExpandedTemplates([]);
      setActionError(err instanceof Error ? err.message : 'Failed to load templates');
    }
  }

  async function openReview(assignmentId: string) {
    if (expandedReviewId === assignmentId) {
      setExpandedReviewId(null);
      return;
    }
    setExpandedReviewId(assignmentId);
    setRejectReason('');
    setActionError(null);
    try {
      const [evRes, reqRes] = await Promise.all([
        fetch(`/api/assignments/${assignmentId}/events`),
        fetch(`/api/assignments/${assignmentId}/requirements`),
      ]);
      if (!evRes.ok) {
        setReviewEvents([]);
        setActionError(await errorFromResponse(evRes));
        return;
      }
      if (!reqRes.ok) {
        setReviewRequirements([]);
        setActionError(await errorFromResponse(reqRes));
        return;
      }
      setReviewEvents((await evRes.json()) as AssignmentEvent[]);
      setReviewRequirements((await reqRes.json()) as AssignmentRequirement[]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load review detail');
    }
  }

  async function approveAssignment(assignmentId: string) {
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_id: ENTERPRISE_USER_ID }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      setExpandedReviewId(null);
      await Promise.all([fetchReview(), fetchCases()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setActing(false);
    }
  }

  async function rejectAssignment(assignmentId: string) {
    if (!rejectReason.trim()) {
      setActionError('Rejection reason is required');
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_id: ENTERPRISE_USER_ID,
          reason: rejectReason.trim(),
        }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      setExpandedReviewId(null);
      setRejectReason('');
      await Promise.all([fetchReview(), fetchCases()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActing(false);
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
            Enterprise Manager
          </span>
        </div>
        <Link href="/" style={{ color: '#93c5fd', fontSize: '0.9rem' }}>
          Sign out
        </Link>
      </header>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 2rem 3rem' }}>
        {/* Section B — Create */}
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Create New Case</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <Field label="Title *" value={title} onChange={setTitle} required />
            <Field label="Store Name" value={storeName} onChange={setStoreName} />
            <Field label="Store Address" value={storeAddress} onChange={setStoreAddress} />
            <Field label="Item Name / Description" value={itemName} onChange={setItemName} />
            <Field label="Barcode / SKU" value={barcodeSku} onChange={setBarcodeSku} />
            <label style={labelStyle}>
              Time Window Start
              <input
                type="datetime-local"
                value={timeWindowStart}
                onChange={(e) => setTimeWindowStart(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Time Window End
              <input
                type="datetime-local"
                value={timeWindowEnd}
                onChange={(e) => setTimeWindowEnd(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Instructions / Brief
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                style={inputStyle}
              />
            </label>
          </div>

          <h3 style={{ fontSize: '0.95rem', color: NAVY, marginTop: '1.25rem' }}>
            Evidence Requirements
          </h3>
          {draftRequirements.map((r) => (
            <div
              key={r.tempId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: '#f1f5f9',
                borderRadius: '6px',
                marginBottom: '0.35rem',
              }}
            >
              <span>
                <span style={statusBadgeStyle(r.kind)}>{r.kind}</span>{' '}
                <strong>{r.label}</strong>
                {r.instructions && (
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}> — {r.instructions}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDraftRequirements((prev) => prev.filter((x) => x.tempId !== r.tempId))
                }
                style={dangerBtn}
              >
                Delete
              </button>
            </div>
          ))}
          {showReqForm ? (
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem' }}>
              <label style={labelStyle}>
                Kind
                <select value={reqKind} onChange={(e) => setReqKind(e.target.value)} style={inputStyle}>
                  <option value="photo">photo</option>
                  <option value="video">video</option>
                  <option value="text">text</option>
                  <option value="signature">signature</option>
                </select>
              </label>
              <Field label="Label *" value={reqLabel} onChange={setReqLabel} />
              <Field label="Instructions" value={reqInstructions} onChange={setReqInstructions} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={addDraftRequirement} style={primaryBtn(BLUE)}>
                  Add
                </button>
                <button type="button" onClick={() => setShowReqForm(false)} style={secondaryBtn}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowReqForm(true)} style={{ ...secondaryBtn, marginTop: '0.5rem' }}>
              + Add requirement
            </button>
          )}

          {formError && <p style={errorStyle}>{formError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => saveCase(false)} disabled={saving} style={primaryBtn(NAVY)}>
              {saving ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => saveCase(true)}
              disabled={saving || draftRequirements.length === 0}
              style={primaryBtn(BLUE)}
            >
              {saving ? 'Saving…' : 'Save & Publish'}
            </button>
          </div>
        </section>

        {/* Section C — Dashboard */}
        <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
          <h2 style={sectionTitle}>Case Dashboard</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {CASE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCaseFilter(s)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: caseFilter === s ? `2px solid ${BLUE}` : '1px solid #cbd5e1',
                  background: caseFilter === s ? '#dbeafe' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textTransform: 'capitalize',
                }}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          {listError && <p style={errorStyle}>{listError}</p>}
          {loadingCases && !listError && <p>Loading...</p>}
          {!loadingCases && !listError && filteredCases.length === 0 && <p>No cases.</p>}
          {filteredCases.map((c) => (
            <div key={c.id} style={caseCardStyle}>
              <button
                type="button"
                onClick={() => toggleCaseExpand(c.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '1.05rem', color: NAVY }}>{c.title}</strong>
                    <p style={{ margin: '0.25rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                      {[c.store_name, c.store_address].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                      {[c.item_name, c.barcode_sku].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      {formatWindow(c.time_window_start, c.time_window_end)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={statusBadgeStyle(c.status)}>{c.status}</span>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      {(assignmentsByCase[c.id] ?? []).length} assignment(s)
                    </p>
                  </div>
                </div>
              </button>
              {expandedCaseId === c.id && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <p>
                    <strong>Instructions:</strong> {c.instructions || '—'}
                  </p>
                  <p style={{ marginTop: '0.75rem' }}>
                    <strong>Evidence requirements:</strong>
                  </p>
                  {expandedTemplates.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>None</p>
                  ) : (
                    <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
                      {expandedTemplates.map((t) => (
                        <li key={t.id}>
                          <span style={statusBadgeStyle(t.kind)}>{t.kind}</span> {t.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p style={{ marginTop: '0.75rem' }}>
                    <strong>Assignments:</strong>
                  </p>
                  {(assignmentsByCase[c.id] ?? []).length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>None</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                      {(assignmentsByCase[c.id] ?? []).map((a) => (
                        <li key={a.id}>
                          {a.assigned_to.slice(0, 8)}… —{' '}
                          <span style={statusBadgeStyle(a.status)}>{a.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Section D — Review */}
        <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
          <h2 style={sectionTitle}>Awaiting Review</h2>
          {reviewError && <p style={errorStyle}>{reviewError}</p>}
          {loadingReview && !reviewError && <p>Loading...</p>}
          {!loadingReview && !reviewError && reviewAssignments.length === 0 && (
            <p>No submissions awaiting review.</p>
          )}
          {actionError && <p style={errorStyle}>{actionError}</p>}
          {reviewAssignments.map((a) => {
            const qc = reviewCases[a.qc_case_id];
            return (
              <div key={a.id} style={caseCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: NAVY }}>{qc?.title ?? a.qc_case_id}</strong>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                      Worker: {a.assigned_to}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      Submitted: {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  <button type="button" onClick={() => openReview(a.id)} style={primaryBtn(BLUE)}>
                    {expandedReviewId === a.id ? 'Close' : 'Review'}
                  </button>
                </div>
                {expandedReviewId === a.id && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <p>
                      <strong>Event history</strong>
                    </p>
                    {reviewEvents.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No events</p>
                    ) : (
                      <ul style={{ fontSize: '0.85rem', paddingLeft: '1.25rem' }}>
                        {reviewEvents.map((e) => (
                          <li key={e.id}>
                            {e.event_type}: {e.from_status ?? '—'} → {e.to_status} (
                            {new Date(e.created_at).toLocaleString()})
                            {e.reason && ` — ${e.reason}`}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p style={{ marginTop: '0.75rem' }}>
                      <strong>Requirements</strong>
                    </p>
                    <ul style={{ fontSize: '0.85rem', paddingLeft: '1.25rem' }}>
                      {reviewRequirements.map((r) => (
                        <li key={r.id}>
                          {r.label} ({r.kind}) —{' '}
                          <span style={statusBadgeStyle(r.status)}>{r.status}</span>
                          {r.is_mandatory && ' *'}
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => approveAssignment(a.id)}
                        style={primaryBtn('#047857')}
                      >
                        Approve
                      </button>
                    </div>
                    <label style={{ ...labelStyle, marginTop: '0.75rem', display: 'block' }}>
                      Rejection reason *
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        style={inputStyle}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => rejectAssignment(a.id)}
                      style={{ ...dangerBtn, marginTop: '0.5rem' }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={inputStyle}
      />
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: NAVY,
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

const caseCardStyle: React.CSSProperties = {
  ...cardStyle,
  marginBottom: '0.75rem',
  padding: '1rem 1.25rem',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1.15rem',
  color: NAVY,
};

const errorStyle: React.CSSProperties = { color: '#b91c1c', marginTop: '0.75rem' };

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

const secondaryBtn: React.CSSProperties = {
  padding: '0.5rem 0.9rem',
  background: '#fff',
  color: NAVY,
  border: `1px solid ${NAVY}`,
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.85rem',
};

const dangerBtn: React.CSSProperties = {
  padding: '0.4rem 0.65rem',
  background: '#fee2e2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
