'use client';

import Link from 'next/link';

const NAVY = '#1B2D4F';
const BLUE = '#2E6DA4';
const LIGHT_BLUE = '#D6E4F0';

export default function Home() {
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

        <label style={labelStyle}>
          Email
          <input type="email" defaultValue="demo@prooflayer.ai" style={inputStyle} readOnly />
        </label>
        <label style={{ ...labelStyle, marginTop: '0.85rem' }}>
          Password
          <input type="password" defaultValue="demo123" style={inputStyle} readOnly />
        </label>
        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.5rem 0 1.25rem' }}>
          Demo password: demo123
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/enterprise" style={roleCardStyle}>
            <strong style={{ color: NAVY, fontSize: '0.95rem' }}>Enterprise Manager</strong>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              Dashboard · Case creation · Reports
            </p>
          </Link>
          <Link href="/field" style={roleCardStyle}>
            <strong style={{ color: NAVY, fontSize: '0.95rem' }}>Field Worker</strong>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              Task list · Geo check-in · Evidence upload
            </p>
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

const roleCardStyle: React.CSSProperties = {
  flex: 1,
  padding: '1rem',
  background: LIGHT_BLUE,
  border: `2px solid ${BLUE}`,
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'block',
  transition: 'box-shadow 0.15s',
};
