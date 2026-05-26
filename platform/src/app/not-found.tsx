export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>404</h1>
        <p style={{ color: 'var(--text-muted)' }}>Page not found</p>
      </div>
    </div>
  );
}
