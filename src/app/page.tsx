'use client';

import Link from 'next/link';

const NAVY = '#1B2D4F';
const BLUE = '#2E6DA4';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #f0f4f8 0%, #e2e8f0 100%)',
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
          maxWidth: '420px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(27, 45, 79, 0.12)',
          padding: '2.5rem 2rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              background: BLUE,
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
          <span style={{ fontSize: '1.35rem', fontWeight: 700, color: NAVY }}>ProofLayer AI</span>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.75rem 0' }}>
          Geospatial Verification Platform
        </p>

        <label style={labelStyle}>
          Email
          <input type="email" placeholder="you@company.com" style={inputStyle} readOnly />
        </label>
        <label style={{ ...labelStyle, marginTop: '1rem' }}>
          Password
          <input type="password" placeholder="••••••••" style={inputStyle} readOnly />
        </label>

        <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '1.25rem 0 1rem', textAlign: 'center' }}>
          Select role to continue (demo — no authentication)
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/enterprise" style={{ ...roleBtnStyle, background: NAVY }}>
            Enterprise Manager
          </Link>
          <Link href="/field" style={{ ...roleBtnStyle, background: BLUE }}>
            Field Worker
          </Link>
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

const roleBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.75rem 0.5rem',
  color: '#fff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontSize: '0.8rem',
  fontWeight: 600,
  textAlign: 'center',
};
