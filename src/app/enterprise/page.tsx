'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ENTERPRISE_USER_ID,
  ORGANIZATION_ID,
} from '@/lib/identity';

type QcCase = {
  id: string;
  title: string;
  description: string | null;
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

export default function EnterprisePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cases, setCases] = useState<QcCase[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
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
    } catch (err) {
      setCases([]);
      setListError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/qc-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: ORGANIZATION_ID,
          created_by: ENTERPRISE_USER_ID,
          title,
          description: description || null,
          status: 'open',
        }),
      });
      if (!res.ok) {
        setSubmitError(await errorFromResponse(res));
        return;
      }
      setTitle('');
      setDescription('');
      await fetchCases();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '640px' }}>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>Enterprise View</h1>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Create QC Case</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
            />
          </label>
          <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem', alignSelf: 'flex-start' }}>
            {submitting ? 'Creating…' : 'Create Case'}
          </button>
        </form>
        {submitError && (
          <p role="alert" style={{ color: '#b00020', marginTop: '0.75rem' }}>
            {submitError}
          </p>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>All Cases</h2>
        {listError && (
          <p role="alert" style={{ color: '#b00020' }}>
            {listError}
          </p>
        )}
        {loading && !listError && <p>Loading…</p>}
        {!loading && !listError && cases.length === 0 && <p>No cases yet.</p>}
        {!listError && cases.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
            {cases.map((c) => (
              <li
                key={c.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                <strong>{c.title}</strong>
                <span style={{ marginLeft: '0.5rem', color: '#666' }}>({c.status})</span>
                {c.description && <p style={{ margin: '0.5rem 0 0' }}>{c.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
