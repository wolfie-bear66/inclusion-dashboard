// Shared status-counting helper. Single source of truth for the four
// non-overlapping buckets used across the app's various views.
//
// Valid entries.status values are exactly: 'in_place', 'in_progress', 'not_in_place'.
// A provision point with no entries row at all (never touched) is 'notStarted' —
// there is no separate "Untouched by Choice" status anywhere in the schema.
//
// points:          array of { id, ...anything else needed by `scope` }, already
//                   representing the provision points to count over. Points are
//                   treated as active unless a point explicitly carries `active: false`.
// statusByPointId:  map of provision_point_id -> entries.status ('in_place' |
//                   'in_progress' | 'not_in_place' | undefined/falsy for no row).
// scope:            optional predicate (point) => boolean to narrow to a subset,
//                   e.g. a single principle, domain, or category. Omit for all points.
//
// Returns { inPlace, inProgress, notInPlace, notStarted, total } where the four
// buckets always sum exactly to total.
export function computeCounts(points, statusByPointId, scope) {
  const activePoints = points.filter(p => p.active !== false)
  const scoped = scope ? activePoints.filter(scope) : activePoints

  let inPlace = 0
  let inProgress = 0
  let notInPlace = 0
  let notStarted = 0

  for (const point of scoped) {
    const status = statusByPointId[point.id]
    if (status === 'in_place') inPlace++
    else if (status === 'in_progress') inProgress++
    else if (status === 'not_in_place') notInPlace++
    else notStarted++
  }

  return { inPlace, inProgress, notInPlace, notStarted, total: scoped.length }
}
