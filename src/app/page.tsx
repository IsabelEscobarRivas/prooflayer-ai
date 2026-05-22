'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export { signOut } from '@/lib/auth/sign-out';

const NAVY = '#1B2D4F';
const BLUE = '#2E6DA4';
const LIGHT_BLUE = '#D6E4F0';

const DEMO_ENTERPRISE = { email: 'alex@prooflayer.ai', password: 'demo123' };
const DEMO_FIELD = { email: 'jordan@prooflayer.ai', password: 'demo123' };

const NOT_PROVISIONED = 'Account not provisioned. Contact your administrator.';

type ProoflayerUser = { id: string; role: string };

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = useCallback(
    async (credentials: { email: string; password: string }) => {
      setError(null);
      setSubmitting(true);
      try {
        const supabase = createBrowserClient();
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: credentials.email.trim(),
          password: credentials.password,
        });

        if (authError) {
          setError(authError.message);
          return;
        }

        const authUserId = authData.user?.id;
        if (!authUserId) {
          setError('Sign-in succeeded but no user id was returned.');
          return;
        }

        const res = await fetch(`/api/users/${authUserId}`);
        if (res.status === 404) {
          await supabase.auth.signOut();
          setError(NOT_PROVISIONED);
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `Could not load user profile (${res.status})`);
          return;
        }

        const user = (await res.json()) as ProoflayerUser;
        if (user.role === 'enterprise') {
          router.push('/enterprise');
        } else if (user.role === 'field_worker') {
          router.push('/field');
        } else {
          await supabase.auth.signOut();
          setError(`Unknown role: ${user.role}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sign-in failed');
      } finally {
        setSubmitting(false);
      }
    },
    [router],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    await handleSignIn({ email, password });
  }

  function demoEnterprise() {
    setEmail(DEMO_ENTERPRISE.email);
    setPassword(DEMO_ENTERPRISE.password);
    void handleSignIn(DEMO_ENTERPRISE);
  }

  function demoFieldWorker() {
    setEmail(DEMO_FIELD.email);
    setPassword(DEMO_FIELD.password);
    void handleSignIn(DEMO_FIELD);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: `linear-gradient(160deg, ${LIGHT_BLUE} 0%, #eef2f7 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(27, 45, 79, 0.12)',
          padding: '2.5rem 2rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              background: NAVY,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
            }}
          >
            PL
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: NAVY }}>
            ProofLayer AI
          </h1>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>
          Geospatial Verification Platform
        </p>

        <form onSubmit={onSubmit}>
          <label style={labelStyle}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, marginTop: '0.85rem' }}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={inputStyle}
            />
          </label>

          {error && (
            <p style={{ color: '#C62828', fontSize: '0.85rem', margin: '0.75rem 0 0' }} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...submitBtnStyle,
              marginTop: '1.25rem',
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '1.25rem 0 0.75rem', textAlign: 'center' }}>
          Demo accounts
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={demoEnterprise}
            disabled={submitting}
            style={roleCardStyle}
          >
            <strong style={{ color: NAVY, fontSize: '0.95rem' }}>Demo: Enterprise</strong>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              alex@prooflayer.ai
            </p>
          </button>
          <button
            type="button"
            onClick={demoFieldWorker}
            disabled={submitting}
            style={roleCardStyle}
          >
            <strong style={{ color: NAVY, fontSize: '0.95rem' }}>Demo: Field Worker</strong>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              jordan@prooflayer.ai
            </p>
          </button>
        </div>
      </div>
    </main>
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
  padding: '0.6rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

const submitBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.65rem 1rem',
  background: BLUE,
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.95rem',
  fontWeight: 600,
};

const roleCardStyle: React.CSSProperties = {
  flex: 1,
  padding: '1rem',
  background: LIGHT_BLUE,
  border: `2px solid ${BLUE}`,
  borderRadius: '10px',
  cursor: 'pointer',
  textAlign: 'left',
};
