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
  status: string;
};

type Template = { id: string; kind: string; label: string; instructions: string | null };
type Assignment = { id: string; qc_case_id: string; status: string; submitted_at: string | null };
type Requirement = {
  id: string;
  label: string;
  kind: string;
  is_mandatory: boolean;
  status: string;
};
type CheckIn = { id: string; recorded_at: string; is_within_geofence: boolean | null };
type EvidenceFile = { id: string; assignment_evidence_requirement_id: string; storage_path: string | null; upload_status: string };

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
    borderRadius: 4,
    fontSize: '0.7rem',
    fontWeight: 700,
    background: s.bg,
    color: s.color,
    marginRight: 4,
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

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type CheckInStatus = 'unchecked' | 'checking' | 'within' | 'outside';

export default function FieldPage() {
  const router = useRouter();
  const [openCases, setOpenCases] = useState<QcCase[]>([]);
  const [templatesByCase, setTemplatesByCase] = useState<Record<string, Template[]>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [casesById, setCasesById] = useState<Record<string, QcCase>>({});
  const [reqsByAssignment, setReqsByAssignment] = useState<Record<string, Requirement[]>>({});
  const [checkInsByAssignment, setCheckInsByAssignment] = useState<Record<string, CheckIn[]>>({});
  const [filesByAssignment, setFilesByAssignment] = useState<Record<string, EvidenceFile[]>>({});
  const [notesByAssignment, setNotesByAssignment] = useState<Record<string, string>>({});

  const [casesError, setCasesError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkInStatusByAssignment, setCheckInStatusByAssignment] = useState<
    Record<string, CheckInStatus>
  >({});
  const [checkInDistanceByAssignment, setCheckInDistanceByAssignment] = useState<
    Record<string, number>
  >({});
  const [checkInRadiusByAssignment, setCheckInRadiusByAssignment] = useState<
    Record<string, number>
  >({});
  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState('Field Worker');

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
      if (profile.role !== 'field_worker') {
        router.push('/enterprise');
        return;
      }
      setUserId(user.id);
      setUserLabel(profile.full_name ?? profile.email);
    })();
  }, [router]);

  const fetchOpenCases = useCallback(async () => {
    setLoadingCases(true);
    setCasesError(null);
    try {
      const params = new URLSearchParams({
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
      const tmap: Record<string, Template[]> = {};
      for (const c of cases) {
        const tr = await fetch(`/api/qc-cases/${c.id}/templates`);
        tmap[c.id] = tr.ok ? ((await tr.json()) as Template[]) : [];
      }
      setTemplatesByCase(tmap);
    } catch (e) {
      setOpenCases([]);
      setCasesError(e instanceof Error ? e.message : 'Failed to load cases');
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const fetchAssignments = useCallback(async (currentUserId: string) => {
    setLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      const res = await fetch(
        `/api/assignments?assigned_to=${encodeURIComponent(currentUserId)}`,
      );
      if (!res.ok) {
        setAssignments([]);
        setAssignmentsError(await errorFromResponse(res));
        return;
      }
      const assigns = (await res.json()) as Assignment[];
      setAssignments(assigns);
      const cmap: Record<string, QcCase> = {};
      const rmap: Record<string, Requirement[]> = {};
      const chimap: Record<string, CheckIn[]> = {};
      const fmap: Record<string, EvidenceFile[]> = {};

      for (const a of assigns) {
        if (!cmap[a.qc_case_id]) {
          const cr = await fetch(`/api/qc-cases/${a.qc_case_id}`);
          if (cr.ok) cmap[a.qc_case_id] = (await cr.json()) as QcCase;
        }
        const rr = await fetch(`/api/assignments/${a.id}/requirements`);
        rmap[a.id] = rr.ok ? ((await rr.json()) as Requirement[]) : [];
        const fr = await fetch(`/api/evidence-files?assignment_id=${a.id}`);
        fmap[a.id] = fr.ok ? ((await fr.json()) as EvidenceFile[]) : [];
      }
      setCasesById(cmap);
      setReqsByAssignment(rmap);
      setFilesByAssignment(fmap);
      setCheckInsByAssignment(chimap);
    } catch (e) {
      setAssignmentsError(e instanceof Error ? e.message : 'Failed to load assignments');
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await Promise.all([fetchOpenCases(), fetchAssignments(userId)]);
  }, [userId, fetchOpenCases, fetchAssignments]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
  }, [userId, refresh]);

  async function handleAccept(qcCaseId: string) {
    setActionError(null);
    setSuccessMsg(null);
    setAcceptingId(qcCaseId);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qc_case_id: qcCaseId,
        }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      setSuccessMsg('Assignment accepted — requirements snapshotted');
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleCheckIn(assignmentId: string, qcCaseId: string) {
    setActionError(null);
    setCheckInStatusByAssignment((p) => ({ ...p, [assignmentId]: 'checking' }));
    setCheckingInId(assignmentId);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      const caseRes = await fetch(`/api/qc-cases/${qcCaseId}`);
      if (!caseRes.ok) {
        setActionError(await errorFromResponse(caseRes));
        setCheckInStatusByAssignment((p) => ({ ...p, [assignmentId]: 'unchecked' }));
        return;
      }
      const caseData = (await caseRes.json()) as QcCase;

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      const radius = caseData.geo_radius_m ?? 100;
      let distance = 0;
      let within = false;

      if (caseData.geo_lat != null && caseData.geo_lng != null) {
        distance = haversineMeters(lat, lng, Number(caseData.geo_lat), Number(caseData.geo_lng));
        within = distance <= radius;
      }

      const res = await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          lat,
          lng,
          recorded_at: new Date().toISOString(),
          accuracy_m: accuracy,
          distance_from_target_m: distance,
          geo_radius_m: caseData.geo_radius_m,
          is_within_geofence: within,
          device_info: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        setCheckInStatusByAssignment((p) => ({ ...p, [assignmentId]: 'unchecked' }));
        return;
      }

      const row = (await res.json()) as CheckIn;
      setCheckInsByAssignment((p) => ({
        ...p,
        [assignmentId]: [...(p[assignmentId] ?? []), row],
      }));
      setCheckInDistanceByAssignment((p) => ({ ...p, [assignmentId]: Math.round(distance) }));
      setCheckInRadiusByAssignment((p) => ({ ...p, [assignmentId]: radius }));
      setCheckInStatusByAssignment((p) => ({
        ...p,
        [assignmentId]: within ? 'within' : 'outside',
      }));
    } catch (e) {
      const geoCode = e && typeof e === 'object' && 'code' in e ? (e as { code: number }).code : null;
      if (geoCode === 1) {
        setActionError(
          'Location permission required. Enable location access in your browser settings.',
        );
      } else {
        setActionError(e instanceof Error ? e.message : 'Check-in failed');
      }
      setCheckInStatusByAssignment((p) => ({ ...p, [assignmentId]: 'unchecked' }));
    } finally {
      setCheckingInId(null);
    }
  }

  async function handleEvidenceUpload(
    assignmentId: string,
    requirementId: string,
    file: File,
  ) {
    setUploadingReqId(requirementId);
    setActionError(null);
    try {
      const res = await fetch('/api/evidence-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          assignment_evidence_requirement_id: requirementId,
          storage_path: `pending/${assignmentId}/${file.name}`,
          mime_type: file.type || null,
          byte_size: file.size,
          captured_at: new Date().toISOString(),
          upload_status: 'uploaded',
        }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      setSuccessMsg(`Evidence uploaded: ${file.name}`);
      if (userId) await fetchAssignments(userId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingReqId(null);
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
          assignment_id: assignmentId,
          notes: notesByAssignment[assignmentId]?.trim() || null,
        }),
      });
      if (!res.ok) {
        setActionError(await errorFromResponse(res));
        return;
      }
      setSuccessMsg('Submitted for review');
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: NAVY, color: '#fff', padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, background: BLUE, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>PL</div>
          <div>
            <div style={{ fontWeight: 700 }}>ProofLayer AI</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Field Worker</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>FW</div>
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
        {actionError && <p style={{ color: '#C62828', marginBottom: '1rem' }}>{actionError}</p>}

        <section style={card}>
          <h2 style={h2}>Available Cases</h2>
          {casesError && <p style={err}>{casesError}</p>}
          {loadingCases && !casesError && <p>Loading...</p>}
          {!loadingCases && !casesError && openCases.length === 0 && <p>No open cases available.</p>}
          {openCases.map((c) => (
            <div key={c.id} style={listCard}>
              <strong style={{ color: NAVY, fontSize: '1.05rem' }}>{c.title}</strong>
              <p style={{ margin: '0.35rem 0', color: '#555', fontSize: '0.9rem' }}>{[c.store_name, c.store_address].filter(Boolean).join(' · ')}</p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#777' }}>{[c.item_name, c.barcode_sku].filter(Boolean).join(' · ')}</p>
              {formatTimeWindow(c.time_window_start, c.time_window_end) && (
                <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#999' }}>
                  {formatTimeWindow(c.time_window_start, c.time_window_end)}
                </p>
              )}
              {c.instructions && <p style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}><strong>Brief:</strong> {c.instructions}</p>}
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}><strong>Evidence required:</strong></p>
              <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                {(templatesByCase[c.id] ?? []).map((t) => (
                  <li key={t.id}><span style={badge(t.kind)}>{formatStatus(t.kind)}</span> {t.label}</li>
                ))}
              </ul>
              <button type="button" disabled={acceptingId === c.id} onClick={() => handleAccept(c.id)} style={{ ...btnPrimary(BLUE), marginTop: '0.75rem' }}>
                {acceptingId === c.id ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          ))}
        </section>

        <section style={{ ...card, marginTop: '1.25rem' }}>
          <h2 style={h2}>My Active Assignments</h2>
          {assignmentsError && <p style={err}>{assignmentsError}</p>}
          {loadingAssignments && !assignmentsError && <p>Loading...</p>}
          {!loadingAssignments && !assignmentsError && assignments.length === 0 && <p>No assignments yet.</p>}
          {assignments.map((a) => {
            const qc = casesById[a.qc_case_id];
            const reqs = reqsByAssignment[a.id] ?? [];
            const files = filesByAssignment[a.id] ?? [];
            const checkIns = checkInsByAssignment[a.id] ?? [];
            const checkInStatus = checkInStatusByAssignment[a.id] ?? 'unchecked';
            const geoRequired = qc?.geo_lat != null;
            const canSubmit = !geoRequired || checkInStatus === 'within';
            const distanceM = checkInDistanceByAssignment[a.id];
            const radiusM = checkInRadiusByAssignment[a.id];
            return (
              <div key={a.id} style={listCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: NAVY }}>{qc?.title ?? a.qc_case_id}</strong>
                  <span style={badge(a.status)}>{formatStatus(a.status)}</span>
                </div>
                {qc && (
                  <>
                    <p style={{ margin: '0.35rem 0', fontSize: '0.9rem', color: '#555' }}>{[qc.store_name, qc.store_address].filter(Boolean).join(' · ')}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#777' }}>{[qc.item_name, qc.barcode_sku].filter(Boolean).join(' · ')}</p>
                    {formatTimeWindow(qc.time_window_start, qc.time_window_end) && (
                      <p style={{ fontSize: '0.8rem', color: '#999' }}>
                        {formatTimeWindow(qc.time_window_start, qc.time_window_end)}
                      </p>
                    )}
                  </>
                )}

                {a.status === 'in_progress' && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
                    {qc?.instructions && <p style={{ fontSize: '0.9rem' }}><strong>Instructions:</strong> {qc.instructions}</p>}

                    <div style={{ marginTop: '0.75rem', background: LIGHT_BLUE, padding: '0.75rem', borderRadius: 8 }}>
                      <strong style={{ fontSize: '0.9rem', color: NAVY }}>Geo Check-in</strong>
                      {!geoRequired ? (
                        <p style={{ fontSize: '0.85rem', color: '#888', margin: '0.5rem 0 0' }}>
                          Location check not required for this case
                        </p>
                      ) : (
                        <>
                          {qc?.geo_lat != null && (
                            <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.25rem 0' }}>
                              Target: {qc.geo_lat}, {qc.geo_lng} · radius {qc.geo_radius_m ?? 100}m
                            </p>
                          )}
                          {checkInStatus !== 'outside' && (
                            <button
                              type="button"
                              disabled={checkingInId === a.id}
                              onClick={() => handleCheckIn(a.id, a.qc_case_id)}
                              style={{ ...btnPrimary(NAVY), marginTop: '0.35rem' }}
                            >
                              {checkingInId === a.id || checkInStatus === 'checking'
                                ? 'Checking in…'
                                : 'Check In'}
                            </button>
                          )}
                          {checkInStatus === 'within' && distanceM != null && (
                            <p style={{ fontSize: '0.85rem', color: '#2E7D32', margin: '0.5rem 0 0', fontWeight: 600 }}>
                              ✓ Checked in — within {distanceM}m of store
                            </p>
                          )}
                          {checkInStatus === 'outside' && distanceM != null && radiusM != null && (
                            <>
                              <p style={{ fontSize: '0.85rem', color: '#C62828', margin: '0.5rem 0 0', fontWeight: 600 }}>
                                ✗ {distanceM}m from store. Must be within {radiusM}m.
                              </p>
                              <button
                                type="button"
                                disabled={checkingInId === a.id}
                                onClick={() => handleCheckIn(a.id, a.qc_case_id)}
                                style={{ ...btnGhost, marginTop: '0.35rem' }}
                              >
                                Try Again
                              </button>
                            </>
                          )}
                          {checkIns.length > 0 && checkInStatus === 'unchecked' && (
                            <ul style={{ fontSize: '0.8rem', margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                              {checkIns.map((ci) => (
                                <li key={ci.id}>
                                  {new Date(ci.recorded_at).toLocaleString()}{' '}
                                  {ci.is_within_geofence === true
                                    ? '✓ in geofence'
                                    : ci.is_within_geofence === false
                                      ? '✗ outside'
                                      : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>

                    <p style={{ fontSize: '0.9rem', marginTop: '0.75rem' }}><strong>Evidence checklist</strong></p>
                    {reqs.map((r) => {
                      const uploaded = files.filter((f) => f.assignment_evidence_requirement_id === r.id);
                      return (
                        <div key={r.id} style={{ background: '#fafbfc', padding: '0.65rem', borderRadius: 6, marginBottom: 6 }}>
                          <span style={badge(r.kind)}>{formatStatus(r.kind)}</span> <strong>{r.label}</strong>
                          {r.is_mandatory && <span style={{ color: '#E65100' }}> *</span>}
                          <span style={badge(r.status)}>{formatStatus(r.status)}</span>
                          {uploaded.length > 0 && <span style={{ fontSize: '0.75rem', color: '#2E7D32', marginLeft: 6 }}>{uploaded.length} file(s)</span>}
                          <div style={{ marginTop: 6 }}>
                            <label style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input
                                type="file"
                                accept={r.kind === 'photo' ? 'image/*' : r.kind === 'video' ? 'video/*' : '*/*'}
                                style={{ fontSize: '0.8rem' }}
                                disabled={uploadingReqId === r.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleEvidenceUpload(a.id, r.id, f);
                                  e.target.value = '';
                                }}
                              />
                              {uploadingReqId === r.id ? ' Uploading…' : ' Upload evidence'}
                            </label>
                          </div>
                        </div>
                      );
                    })}

                    <label style={lbl}>Submission notes
                      <textarea value={notesByAssignment[a.id] ?? ''} onChange={(e) => setNotesByAssignment((p) => ({ ...p, [a.id]: e.target.value }))} rows={2} style={inp} />
                    </label>
                    {canSubmit ? (
                      <button type="button" disabled={submittingId === a.id} onClick={() => handleSubmit(a.id)} style={{ ...btnPrimary(BLUE), marginTop: '0.5rem' }}>
                        {submittingId === a.id ? 'Submitting…' : 'Submit for Review'}
                      </button>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
                        Complete a successful geo check-in before submitting.
                      </p>
                    )}
                  </div>
                )}

                {a.status === 'submitted' && (
                  <p style={{ marginTop: '0.75rem', color: '#E65100', fontWeight: 600 }}>Submitted — awaiting review</p>
                )}
                {a.status === 'approved' && (
                  <p style={{ marginTop: '0.75rem', color: '#2E7D32', fontWeight: 600 }}>Approved — work complete</p>
                )}
                {a.status === 'rejected' && (
                  <p style={{ marginTop: '0.75rem', color: '#C62828' }}>Rejected — accept a new case from Available Cases above</p>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(27,45,79,0.06)', padding: '1.25rem' };
const listCard: React.CSSProperties = { border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '0.65rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', background: '#fff' };
const h2: React.CSSProperties = { margin: '0 0 1rem', color: NAVY, fontSize: '1.15rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: NAVY, marginTop: '0.75rem' };
const inp: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' };
const err: React.CSSProperties = { color: '#C62828' };
function btnPrimary(bg: string): React.CSSProperties {
  return { padding: '0.55rem 1rem', background: bg, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' };
}
const btnGhost: React.CSSProperties = {
  padding: '0.45rem 0.85rem',
  background: '#fff',
  color: NAVY,
  border: `1px solid ${NAVY}`,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85rem',
};
