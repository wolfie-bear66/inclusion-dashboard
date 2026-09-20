// Report Builder's "Due for review" toggle — VERBATIM copy of the query and row-building
// logic in loadOverdueReviews() (App.jsx), so the report's list matches the homepage
// "Coming up for review" box exactly for the same school. Used ONLY by ReportBuilder.
// Deliberately duplicated rather than shared, per the homepage-code freeze in effect while
// other sessions are editing App.jsx's homepage/ledger — see TASKS.md.
//
// KEEP IN SYNC WITH loadOverdueReviews (App.jsx) MANUALLY — consolidate the two into one
// shared helper once the homepage restructure lands and this file can safely import from it.
export async function fetchDueForReviewRows(supabase, schoolId) {
  if (!schoolId) return []
  const todayDate = new Date()
  const today = todayDate.toISOString().slice(0, 10)
  const horizonDate = new Date(todayDate)
  horizonDate.setDate(horizonDate.getDate() + 60)
  const horizon = horizonDate.toISOString().slice(0, 10)

  const { data } = await supabase
    .from('entries')
    .select(`provision_point_id, evidence_entries(
      id, provision_name, next_review_due, review_cycle, date_last_reviewed, date_started, created_at,
      brief_description, named_role_policy_document, supporting_document_link, structured_detail
    )`)
    .eq('school_id', schoolId)

  if (!data) return []
  const upcoming = []
  for (const entry of data) {
    for (const ev of entry.evidence_entries ?? []) {
      if (ev.next_review_due && ev.next_review_due <= horizon) {
        upcoming.push({
          evidenceEntryId:        ev.id,
          provisionPointId:       entry.provision_point_id,
          provisionName:          ev.provision_name || '',
          nextReviewDue:          ev.next_review_due,
          reviewCycle:            ev.review_cycle,
          dateLastReviewed:       ev.date_last_reviewed,
          dateStarted:            ev.date_started,
          createdAt:              ev.created_at,
          briefDescription:       ev.brief_description,
          namedRolePolicyDocument: ev.named_role_policy_document,
          supportingDocumentLink: ev.supporting_document_link,
          structuredDetail:       ev.structured_detail,
          isOverdue:              ev.next_review_due <= today,
        })
      }
    }
  }
  upcoming.sort((a, b) => a.nextReviewDue.localeCompare(b.nextReviewDue))
  return upcoming
}
