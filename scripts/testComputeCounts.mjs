// No test runner is configured in this project (see package.json — no jest/vitest).
// Run with: node scripts/testComputeCounts.mjs
import { computeCounts } from '../src/utils/computeCounts.js'

let failures = 0
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    failures++
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
  } else {
    console.log(`ok — ${label}`)
  }
}

// Fixture: 10 points across 2 principles, 2 domains, 2 categories
const points = [
  { id: 'p1', principle: 'Leadership', domainId: 'd1', category: 'Named Person' },
  { id: 'p2', principle: 'Leadership', domainId: 'd1', category: 'Named Person' },
  { id: 'p3', principle: 'Leadership', domainId: 'd1', category: 'Policy' },
  { id: 'p4', principle: 'Leadership', domainId: 'd2', category: 'Policy' },
  { id: 'p5', principle: 'Culture', domainId: 'd2', category: 'Policy' },
  { id: 'p6', principle: 'Culture', domainId: 'd2', category: 'Policy' },
  { id: 'p7', principle: 'Culture', domainId: 'd2', category: 'Policy' },
  { id: 'p8', principle: 'Culture', domainId: 'd2', category: 'Policy' },
  { id: 'p9', principle: 'Culture', domainId: 'd2', category: 'Policy', active: false }, // inactive — must be excluded
  { id: 'p10', principle: 'Culture', domainId: 'd2', category: 'Policy' },
]

const statusByPointId = {
  p1: 'in_place',
  p2: 'in_progress',
  p3: 'not_in_place',
  // p4: no row at all -> notStarted
  p5: 'in_place',
  p6: 'not_in_place',
  p7: 'not_in_place',
  // p8: no row -> notStarted
  p9: 'in_place', // inactive, must not be counted anywhere
  // p10: no row -> notStarted
}

// 1. All points (excluding the inactive one) — total 9
assertEqual(
  computeCounts(points, statusByPointId),
  { inPlace: 2, inProgress: 1, notInPlace: 3, notStarted: 3, total: 9 },
  'all active points'
)

// 2. Buckets sum to total, always
{
  const r = computeCounts(points, statusByPointId)
  assertEqual(r.inPlace + r.inProgress + r.notInPlace + r.notStarted, r.total, 'buckets sum to total (all points)')
}

// 3. Scoped to a principle
assertEqual(
  computeCounts(points, statusByPointId, p => p.principle === 'Leadership'),
  { inPlace: 1, inProgress: 1, notInPlace: 1, notStarted: 1, total: 4 },
  'scoped to Leadership principle'
)

// 4. Scoped to a domain
assertEqual(
  computeCounts(points, statusByPointId, p => p.domainId === 'd2'),
  { inPlace: 1, inProgress: 0, notInPlace: 2, notStarted: 3, total: 6 },
  'scoped to domain d2 (excludes inactive p9)'
)

// 5. Scoped to a category
assertEqual(
  computeCounts(points, statusByPointId, p => p.category === 'Named Person'),
  { inPlace: 1, inProgress: 1, notInPlace: 0, notStarted: 0, total: 2 },
  'scoped to Named Person category'
)

// 6. Empty input
assertEqual(
  computeCounts([], {}),
  { inPlace: 0, inProgress: 0, notInPlace: 0, notStarted: 0, total: 0 },
  'empty points array'
)

// 7. Every point untouched
assertEqual(
  computeCounts([{ id: 'x1' }, { id: 'x2' }], {}),
  { inPlace: 0, inProgress: 0, notInPlace: 0, notStarted: 2, total: 2 },
  'all points untouched -> notStarted'
)

if (failures > 0) {
  console.error(`\n${failures} failure(s).`)
  process.exit(1)
} else {
  console.log('\nAll computeCounts tests passed.')
}
