import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Prooflayer</h1>
      <p>Select a view:</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <Link
          href="/enterprise"
          style={{
            padding: '0.75rem 1.25rem',
            border: '1px solid #333',
            borderRadius: '4px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          Enterprise View
        </Link>
        <Link
          href="/field"
          style={{
            padding: '0.75rem 1.25rem',
            border: '1px solid #333',
            borderRadius: '4px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          Field Worker View
        </Link>
      </div>
    </main>
  );
}
