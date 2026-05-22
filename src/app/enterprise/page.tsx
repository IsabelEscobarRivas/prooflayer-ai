'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { signOut } from '@/lib/auth/sign-out';
import { createBrowserClient } from '@/lib/supabase/client';

const NAVY = '#1B2D4F';
const BLUE = '#2E6DA4';
const LIGHT_BLUE = '#D6E4F0';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#eeeeee', color: '#888888' },
  open: { bg: LIGHT_BLUE, color: BLUE },
  in_review: { bg: '#fff3e0', color: '#E65100' },
  closed: { bg: '#e8f5e9', color: '#2E7D32' },
  pending: { bg: '#eeeeee', color: '#888888' },
  in_progress: { bg: LIGHT_BLUE, color: BLUE },
  submitted: { bg: '#fff3e0', color: '#E65100' },
  approved: { bg: '#e8f5e9', color: '#2E7D32' },
  rejected: { bg: '#ffebee', color: '#C62828' },
  low: { bg: '#f5f5f5', color: '#666' },
  normal: { bg: LIGHT_BLUE, color: BLUE },
  high: { bg: '#fff3e0', color: '#E65100' },
  urgent: { bg: '#ffebee', color: '#C62828' },
};

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
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius_m: number | null;
  priority: string;
  external_ref: string | null;
  status: string;
};

type Assignment = {
  id: string;
  qc_case_id: string;
  assigned_to: string;
  status: string;
  submitted_at: string | null;
};

type Template = { id: string; kind: string; label: string; instructions: string | null };
type DraftRequirement = { tempId: string; kind: string; label: string; instructions: string };
type AssignmentEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
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

const CASE_FILTERS = ['all', 'draft', 'open', 'in_review', 'closed'] as const;

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

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function badge(status: string): React.CSSProperties {
  const s = STATUS_COLORS[status] ?? { bg: '#eee', color: '#666' };
  return {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 700,
    background: s.bg,
    color: s.color,
    marginRight: '0.35rem',
  };
}

const TIME_DISPLAY_OPTS: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function formatTime(ts: string): string {
  return new Date(ts).toLocaleDateString(undefined, TIME_DISPLAY_OPTS);
}

function formatTimeWindow(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatTime(start)} → ${formatTime(end)}`;
  if (start) return formatTime(start);
  if (end) return formatTime(end);
  return null;
}

function toLocalDatetimeValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EnterprisePage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [externalRef, setExternalRef] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoRadius, setGeoRadius] = useState(100);
  const [itemName, setItemName] = useState('');
  const [barcodeSku, setBarcodeSku] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [instructions, setInstructions] = useState('');
  const [draftReqs, setDraftReqs] = useState<DraftRequirement[]>([]);
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqKind, setReqKind] = useState('photo');
  const [reqLabel, setReqLabel] = useState('');
  const [reqInstructions, setReqInstructions] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const [cases, setCases] = useState<QcCase[]>([]);
  const [assignmentsByCase, setAssignmentsByCase] = useState<Record<string, Assignment[]>>({});
  const [caseFilter, setCaseFilter] = useState<(typeof CASE_FILTERS)[number]>('all');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [caseTemplates, setCaseTemplates] = useState<Template[]>([]);

  const [reviewList, setReviewList] = useState<Assignment[]>([]);
  const [reviewCases, setReviewCases] = useState<Record<string, QcCase>>({});
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [reviewEvents, setReviewEvents] = useState<AssignmentEvent[]>([]);
  const [reviewReqs, setReviewReqs] = useState<AssignmentRequirement[]>([]);
  const [rejectReason, setRejectReason] = useState('');

  const [listError, setListError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingReview, setLoadingReview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState('Enterprise Manager');

  useEffect(() => {
    void (async () => {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }
      const profileRes = await fetch(`/api/users/${user.id}`);
      if (!profileRes.ok) {
        window.location.href = '/';
        return;
      }
      const profile = (await profileRes.json()) as {
        full_name: string | null;
        email: string;
        role: string;
      };
      if (profile.role !== 'enterprise') {
        router.push('/field');
        return;
      }
      setUserId(user.id);
      setUserLabel(profile.full_name ?? profile.email);
    })();
  }, [router]);

  useEffect(() => {
    if (!timeStart) return;
    const start = new Date(timeStart);
    const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    setTimeEnd(toLocalDatetimeValue(end.toISOString()));
  }, [timeStart]);

  const fetchCases = useCallback(async () => {
    setLoadingCases(true);
    setListError(null);
    try {
      const res = await fetch('/api/qc-cases');
      if (!res.ok) {
        setCases([]);
        setListError(await errorFromResponse(res));
        return;
      }
      const data = (await res.json()) as QcCase[];
      setCases(data);
      const aRes = await fetch('/api/assignments');
      if (aRes.ok) {
        const assigns = (await aRes.json()) as Assignment[];
        const map: Record<string, Assignment[]> = {};
        for (const a of assigns) {
          (map[a.qc_case_id] ??= []).push(a);
        }
        setAssignmentsByCase(map);
      }
    } catch (e) {
      setCases([]);
      setListError(e instanceof Error ? e.message : 'Failed to load cases');
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const fetchReview = useCallback(async () => {
    setLoadingReview(true);
    setReviewError(null);
    try {
      const res = await fetch('/api/assignments?status=submitted');
      if (!res.ok) {
        setReviewList([]);
        setReviewError(await errorFromResponse(res));
        return;
      }
      const assigns = (await res.json()) as Assignment[];
      setReviewList(assigns);
      const cmap: Record<string, QcCase> = {};
      for (const a of assigns) {
        if (cmap[a.qc_case_id]) continue;
        const cr = await fetch(`/api/qc-cases/${a.qc_case_id}`);
        if (cr.ok) cmap[a.qc_case_id] = (await cr.json()) as QcCase;
      }
      setReviewCases(cmap);
    } catch (e) {
      setReviewList([]);
      setReviewError(e instanceof Error ? e.message : 'Failed to load review queue');
    } finally {
      setLoadingReview(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchCases();
    fetchReview();
  }, [userId, fetchCases, fetchReview]);

  const filteredCases =
    caseFilter === 'all' ? cases : cases.filter((c) => c.status === caseFilter);

  async function findCoordinates(address: string) {
    if (!address.trim()) return;
    setGeocoding(true);
    setFormError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'ProofLayer/1.0' },
      });
      if (!res.ok) throw new Error('Geocoding request failed');
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (data && data.length > 0) {
        setGeoLat(parseFloat(data[0].lat));
        setGeoLng(parseFloat(data[0].lon));
      } else {
        setFormError('Address not found. Enter coordinates manually.');
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  }

  function resetForm() {
    setTitle('');
    setPriority('normal');
    setExternalRef('');
    setStoreName('');
    setStoreAddress('');
    setGeoLat(null);
    setGeoLng(null);
    setGeoRadius(100);
    setItemName('');
    setBarcodeSku('');
    setTimeStart('');
    setTimeEnd('');
    setInstructions('');
    setDraftReqs([]);
  }

  async function saveCase(publish: boolean) {
    setFormError(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      if (!title.trim() || !storeName.trim() || !storeAddress.trim() || !itemName.trim() || !barcodeSku.trim()) {
        setFormError('Title, store name, address, item name, and barcode are required');
        return;
      }
      if (!timeStart || !timeEnd) {
        setFormError('Time window start and end are required');
        return;
      }
      if (publish && draftReqs.length === 0) {
        setFormError('At least one evidence requirement is required to publish');
        return;
      }

      const caseRes = await fetch('/api/qc-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          instructions: instructions.trim() || null,
          store_name: storeName.trim(),
          store_address: storeAddress.trim(),
          item_name: itemName.trim(),
          barcode_sku: barcodeSku.trim(),
          time_window_start: new Date(timeStart).toISOString(),
          time_window_end: new Date(timeEnd).toISOString(),
          geo_lat: geoLat,
          geo_lng: geoLng,
          geo_radius_m: geoRadius,
          priority,
          external_ref: externalRef.trim() || null,
          status: 'draft',
        }),
      });
      if (!caseRes.ok) {
        setFormError(await errorFromResponse(caseRes));
        return;
      }
      const qcCase = (await caseRes.json()) as QcCase;

      for (const req of draftReqs) {
        const tr = await fetch(`/api/qc-cases/${qcCase.id}/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: req.kind,
            label: req.label,
            instructions: req.instructions || null,
          }),
        });
        if (!tr.ok) {
          setFormError(await errorFromResponse(tr));
          return;
        }
      }

      if (publish) {
        const pr = await fetch(`/api/qc-cases/${qcCase.id}/publish`, { method: 'POST' });
        if (!pr.ok) {
          setFormError(await errorFromResponse(pr));
          return;
        }
      }

      resetForm();
      setFormOpen(false);
      setSuccessMsg(publish ? 'Case published successfully' : 'Case saved as draft');
      await fetchCases();
      setExpandedCaseId(qcCase.id);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save case');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCase(id: string) {
    if (expandedCaseId === id) {
      setExpandedCaseId(null);
      return;
    }
    setExpandedCaseId(id);
    setActionError(null);
    const res = await fetch(`/api/qc-cases/${id}/templates`);
    if (!res.ok) {
      setCaseTemplates([]);
      setActionError(await errorFromResponse(res));
      return;
    }
    setCaseTemplates((await res.json()) as Template[]);
  }

  async function openReview(id: string) {
    if (expandedReviewId === id) {
      setExpandedReviewId(null);
      return;
    }
    setExpandedReviewId(id);
    setRejectReason('');
    setActionError(null);
    const [er, rr] = await Promise.all([
      fetch(`/api/assignments/${id}/events`),
      fetch(`/api/assignments/${id}/requirements`),
    ]);
    if (!er.ok || !rr.ok) {
      setActionError('Failed to load review details');
      return;
    }
    setReviewEvents((await er.json()) as AssignmentEvent[]);
    setReviewReqs((await rr.json()) as AssignmentRequirement[]);
  }

  async function approve(id: string) {
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/assignments/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      setExpandedReviewId(null);
      setSuccessMsg('Assignment approved');
      await Promise.all([fetchReview(), fetchCases()]);
    } finally {
      setActing(false);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      setActionError('Rejection reason is required');
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/assignments/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      setExpandedReviewId(null);
      setRejectReason('');
      setSuccessMsg('Assignment rejected — case returned to open');
      await Promise.all([fetchReview(), fetchCases()]);
    } finally {
      setActing(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: NAVY, color: '#fff', padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, background: BLUE, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>PL</div>
          <div>
            <div style={{ fontWeight: 700 }}>ProofLayer AI</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Enterprise Manager</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>AC</div>
            <span style={{ fontSize: '0.85rem' }}>{userLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              background: 'none',
              border: 'none',
              color: '#93c5fd',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.25rem 1.5rem 3rem' }}>
        {successMsg && <p style={{ background: '#e8f5e9', color: '#2E7D32', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem' }}>{successMsg}</p>}

        {/* Create */}
        <section style={card}>
          {!formOpen ? (
            <button type="button" onClick={() => setFormOpen(true)} style={btnPrimary(BLUE)}>+ New Case</button>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={h2}>Create New Case</h2>
                <button type="button" onClick={() => setFormOpen(false)} style={btnGhost}>Cancel</button>
              </div>

              <div style={subCard}>
                <h3 style={h3}>Case Information</h3>
                <Field label="Case Title *" value={title} onChange={setTitle} />
                <label style={lbl}>Priority
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inp}>
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                  </select>
                </label>
                <Field label="Campaign ID / PO Number" value={externalRef} onChange={setExternalRef} />
              </div>

              <div style={subCard}>
                <h3 style={h3}>Store &amp; Location</h3>
                <Field label="Store Name *" value={storeName} onChange={setStoreName} />
                <Field label="Store Address *" value={storeAddress} onChange={setStoreAddress} />
                <button
                  type="button"
                  onClick={() => findCoordinates(storeAddress)}
                  disabled={geocoding}
                  style={{ ...btnGhost, marginBottom: '0.75rem' }}
                >
                  {geocoding ? 'Finding…' : 'Find Coordinates'}
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <label style={lbl}>
                    Latitude *
                    <input
                      type="number"
                      step="any"
                      value={geoLat ?? ''}
                      onChange={(e) =>
                        setGeoLat(e.target.value === '' ? null : parseFloat(e.target.value))
                      }
                      style={inp}
                    />
                  </label>
                  <label style={lbl}>
                    Longitude *
                    <input
                      type="number"
                      step="any"
                      value={geoLng ?? ''}
                      onChange={(e) =>
                        setGeoLng(e.target.value === '' ? null : parseFloat(e.target.value))
                      }
                      style={inp}
                    />
                  </label>
                  <label style={lbl}>
                    Geofence Radius (metres)
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      step={10}
                      value={geoRadius}
                      onChange={(e) => setGeoRadius(Number(e.target.value))}
                      style={inp}
                    />
                    <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                      Default 100m. Increase for large store footprints.
                    </span>
                  </label>
                </div>
              </div>

              <div style={subCard}>
                <h3 style={h3}>Item Details</h3>
                <Field label="Item Name *" value={itemName} onChange={setItemName} />
                <Field label="Barcode / SKU *" value={barcodeSku} onChange={setBarcodeSku} />
              </div>

              <div style={subCard}>
                <h3 style={h3}>Submission Time Window</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label style={lbl}>Start *
                    <input type="datetime-local" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} style={inp} />
                  </label>
                  <label style={lbl}>End *
                    <input type="datetime-local" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} style={inp} />
                  </label>
                </div>
              </div>

              <div style={subCard}>
                <h3 style={h3}>Instructions / Brief</h3>
                <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="Task brief for field worker" style={inp} />
                <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>AI brief generation coming in Phase 3</p>
              </div>

              <div style={subCard}>
                <h3 style={h3}>Evidence Requirements</h3>
                {draftReqs.map((r) => (
                  <div key={r.tempId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: LIGHT_BLUE, padding: '0.5rem', borderRadius: 6, marginBottom: 6 }}>
                    <span><span style={badge(r.kind)}>{formatStatus(r.kind)}</span> <strong>{r.label}</strong></span>
                    <button type="button" onClick={() => setDraftReqs((p) => p.filter((x) => x.tempId !== r.tempId))} style={btnDanger}>Delete</button>
                  </div>
                ))}
                {showReqForm ? (
                  <div style={{ background: '#fafbfc', padding: '0.75rem', borderRadius: 6 }}>
                    <label style={lbl}>Kind <select value={reqKind} onChange={(e) => setReqKind(e.target.value)} style={inp}>{['photo','video','text','signature'].map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
                    <Field label="Label *" value={reqLabel} onChange={setReqLabel} />
                    <Field label="Instructions" value={reqInstructions} onChange={setReqInstructions} />
                    <button type="button" onClick={() => { if (reqLabel.trim()) { setDraftReqs((p) => [...p, { tempId: crypto.randomUUID(), kind: reqKind, label: reqLabel.trim(), instructions: reqInstructions.trim() }]); setReqLabel(''); setReqInstructions(''); setShowReqForm(false); } }} style={btnPrimary(BLUE)}>Add</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowReqForm(true)} style={btnGhost}>+ Add requirement</button>
                )}
              </div>

              {formError && <p style={err}>{formError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" disabled={saving} onClick={() => saveCase(false)} style={btnPrimary(NAVY)}>{saving ? 'Saving…' : 'Save as Draft'}</button>
                <button type="button" disabled={saving || draftReqs.length === 0} onClick={() => saveCase(true)} style={btnPrimary(BLUE)}>{saving ? 'Saving…' : 'Save & Publish'}</button>
              </div>
            </>
          )}
        </section>

        {/* Dashboard */}
        <section style={{ ...card, marginTop: '1.25rem' }}>
          <h2 style={h2}>Case Dashboard</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
            {CASE_FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setCaseFilter(f)} style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: caseFilter === f ? `2px solid ${BLUE}` : '1px solid #ccc', background: caseFilter === f ? LIGHT_BLUE : '#fff', cursor: 'pointer', textTransform: 'capitalize' }}>{f === 'all' ? 'All' : f.replace('_', ' ')}</button>
            ))}
          </div>
          {listError && <p style={err}>{listError}</p>}
          {loadingCases && !listError && <p>Loading...</p>}
          {!loadingCases && !listError && filteredCases.length === 0 && <p>No cases.</p>}
          {filteredCases.map((c) => (
            <div key={c.id} style={listCard}>
              <button type="button" onClick={() => toggleCase(c.id)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ color: NAVY, fontSize: '1.05rem' }}>{c.title}</strong>
                    <span style={badge(c.priority)}>{formatStatus(c.priority)}</span>
                    <span style={badge(c.status)}>{formatStatus(c.status)}</span>
                    <p style={{ margin: '0.35rem 0 0', color: '#555', fontSize: '0.9rem' }}>{[c.store_name, c.store_address].filter(Boolean).join(' · ')}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#777' }}>{[c.item_name, c.barcode_sku].filter(Boolean).join(' · ')}</p>
                    {formatTimeWindow(c.time_window_start, c.time_window_end) && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#999' }}>
                        {formatTimeWindow(c.time_window_start, c.time_window_end)}
                      </p>
                    )}
                    {c.geo_radius_m != null && <p style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>Geofence: {c.geo_radius_m}m</p>}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>{(assignmentsByCase[c.id] ?? []).length} assignment(s)</span>
                </div>
              </button>
              {expandedCaseId === c.id && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0' }}>
                  <p><strong>Instructions:</strong> {c.instructions || '—'}</p>
                  <p style={{ marginTop: '0.5rem' }}><strong>Templates:</strong></p>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{caseTemplates.map((t) => <li key={t.id}><span style={badge(t.kind)}>{formatStatus(t.kind)}</span> {t.label}</li>)}</ul>
                  <p style={{ marginTop: '0.5rem' }}><strong>Assignments:</strong></p>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                    {(assignmentsByCase[c.id] ?? []).map((a) => (
                      <li key={a.id}>{a.assigned_to.slice(0, 8)}… <span style={badge(a.status)}>{formatStatus(a.status)}</span></li>
                    ))}
                    {(assignmentsByCase[c.id] ?? []).length === 0 && <li>None</li>}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Review */}
        <section style={{ ...card, marginTop: '1.25rem' }}>
          <h2 style={h2}>Awaiting Review</h2>
          {reviewError && <p style={err}>{reviewError}</p>}
          {loadingReview && !reviewError && <p>Loading...</p>}
          {!loadingReview && !reviewError && reviewList.length === 0 && <p>No submissions awaiting review.</p>}
          {actionError && <p style={err}>{actionError}</p>}
          {reviewList.map((a) => {
            const qc = reviewCases[a.qc_case_id];
            return (
              <div key={a.id} style={listCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ color: NAVY }}>{qc?.title ?? a.qc_case_id}</strong>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#666' }}>Worker: {a.assigned_to}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Submitted: {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}</p>
                  </div>
                  <button type="button" onClick={() => openReview(a.id)} style={btnPrimary(BLUE)}>{expandedReviewId === a.id ? 'Close' : 'Review'}</button>
                </div>
                {expandedReviewId === a.id && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e0e0e0', paddingTop: '1rem' }}>
                    <p><strong>Event history</strong></p>
                    <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem' }}>{reviewEvents.map((e) => <li key={e.id}>{formatStatus(e.event_type)}: {e.from_status ? formatStatus(e.from_status) : '—'} → {formatStatus(e.to_status)} ({new Date(e.created_at).toLocaleString()}){e.reason ? ` — ${e.reason}` : ''}</li>)}</ul>
                    <p><strong>Requirements</strong></p>
                    <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem' }}>{reviewReqs.map((r) => <li key={r.id}>{r.label} ({formatStatus(r.kind)}) <span style={badge(r.status)}>{formatStatus(r.status)}</span></li>)}</ul>
                    <button type="button" disabled={acting} onClick={() => approve(a.id)} style={{ ...btnPrimary('#2E7D32'), marginTop: '0.5rem' }}>Approve</button>
                    <label style={{ ...lbl, marginTop: '0.75rem', display: 'block' }}>Rejection reason *
                      <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} style={inp} />
                    </label>
                    <button type="button" disabled={acting} onClick={() => reject(a.id)} style={{ ...btnDanger, marginTop: '0.5rem' }}>Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label style={lbl}>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inp} step={type === 'number' ? 'any' : undefined} /></label>;
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(27,45,79,0.06)', padding: '1.25rem' };
const subCard: React.CSSProperties = { background: '#fafbfc', border: '1px solid #e8e8e8', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem' };
const listCard: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '0.65rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
const h2: React.CSSProperties = { margin: '0 0 0.75rem', color: NAVY, fontSize: '1.15rem' };
const h3: React.CSSProperties = { margin: '0 0 0.65rem', color: NAVY, fontSize: '0.95rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: NAVY, marginBottom: '0.5rem' };
const inp: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '0.5rem 0.65rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' };
const err: React.CSSProperties = { color: '#C62828', marginTop: '0.5rem' };
function btnPrimary(bg: string): React.CSSProperties { return { padding: '0.55rem 1rem', background: bg, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }; }
const btnGhost: React.CSSProperties = { padding: '0.45rem 0.85rem', background: '#fff', color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' };
const btnDanger: React.CSSProperties = { padding: '0.45rem 0.85rem', background: '#ffebee', color: '#C62828', border: '1px solid #ffcdd2', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' };
