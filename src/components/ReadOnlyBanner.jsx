export default function ReadOnlyBanner({ schoolName }) {
  return (
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
      padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 16,
    }}>
      <span style={{ fontSize: '1rem' }}>👁</span>
      <p style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 500, margin: 0 }}>
        You're viewing <strong>{schoolName}</strong> as a MAT admin. This is read-only — switch to your own school to make changes.
      </p>
    </div>
  )
}
