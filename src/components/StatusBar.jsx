// Horizontal 100%-stacked bar for the four provision statuses — on-screen equivalent of the
// same segment order/colours already used in the PDF/Word report generators. No reusable
// on-screen version of this existed anywhere in src/components before now (checked).
//
// counts: { inPlace, inProgress, notInPlace, notStarted, total } — the exact shape
// computeCounts() returns. A zero-count segment is skipped entirely; a total of 0 draws a
// single grey "no data" bar instead of four empty segments.
const SEGMENT_COLOUR = {
  inPlace:    '#2F855A',
  inProgress: '#D99A1B',
  notInPlace: '#C0392B',
  notStarted: '#B8BEC7',
}

export default function StatusBar({ counts, height = 8, showLabel = true }) {
  const pctInPlace = counts.total ? Math.round((counts.inPlace / counts.total) * 100) : 0

  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {counts.total ? `${counts.inPlace} of ${counts.total} in place` : 'No data'}
          </span>
          {counts.total > 0 && (
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1B365D' }}>{pctInPlace}%</span>
          )}
        </div>
      )}
      <div style={{
        display: 'flex', height, borderRadius: height / 2, overflow: 'hidden',
        background: counts.total ? 'transparent' : SEGMENT_COLOUR.notStarted,
      }}>
        {counts.total > 0 && [
          { key: 'inPlace',    value: counts.inPlace },
          { key: 'inProgress', value: counts.inProgress },
          { key: 'notInPlace', value: counts.notInPlace },
          { key: 'notStarted', value: counts.notStarted },
        ].filter(seg => seg.value > 0).map(seg => (
          <div key={seg.key} style={{
            width: `${(seg.value / counts.total) * 100}%`,
            background: SEGMENT_COLOUR[seg.key],
          }} />
        ))}
      </div>
    </div>
  )
}
