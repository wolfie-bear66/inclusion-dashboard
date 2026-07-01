// Shared read-only check for MAT admins browsing a school that isn't their own.
// RLS already blocks these writes server-side — this only controls UI feedback.
export function useIsReadOnlyView(userRole, ownSchoolId, viewedSchoolId) {
  return userRole === 'mat_admin' && Boolean(viewedSchoolId) && viewedSchoolId !== ownSchoolId
}
