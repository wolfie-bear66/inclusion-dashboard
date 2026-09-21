// Shared between App.jsx's BarriersView and the Inclusion Strategy wizard's barrier form —
// pulled into their own module (mirrors constants/principles.js) so both can use the exact
// same option lists, select shape and status labels without importing from one another.

export const STATUS_LABELS = { in_place: 'In Place', in_progress: 'In Progress', not_in_place: 'Not In Place' }

export const BARRIER_GROUPS = [
  { key: 'send', label: 'SEND' },
  { key: 'pp',   label: 'Pupil Premium' },
  { key: 'eal',  label: 'EAL' },
  { key: 'fsm',  label: 'FSM' },
  { key: 'lac',  label: 'LAC' },
  { key: 'wwc',  label: 'White Working Class' },
  { key: 'social_care',            label: 'Social Care' },
  { key: 'young_carer',            label: 'Young Carer' },
  { key: 'mental_health_support',  label: 'Mental Health Support' },
  { key: 'other',label: 'Other' },
]
export const BARRIER_SCALES = [
  { value: 'individual',   label: 'Individual' },
  { value: 'group',        label: 'Group' },
  { value: 'whole_school', label: 'Whole school' },
]
export const BARRIER_SOURCES = [
  { value: 'data_analysis',    label: 'Data analysis' },
  { value: 'staff_observation',label: 'Staff observation' },
  { value: 'pupil_voice',      label: 'Pupil voice' },
  { value: 'family_feedback',  label: 'Family feedback' },
  { value: 'external_review',  label: 'External review' },
]
export const BARRIER_STATUSES = [
  { value: 'active',           label: 'Active' },
  { value: 'being_addressed',  label: 'Being addressed' },
  { value: 'resolved',         label: 'Resolved' },
]
export const BARRIER_STATUS_STYLE = {
  active:          { bg: 'rgba(234,67,53,0.10)',  color: '#EA4335' },
  being_addressed: { bg: 'rgba(212,117,26,0.12)', color: '#D4751A' },
  resolved:        { bg: 'rgba(37,122,59,0.10)',  color: '#257A3B' },
}

// universal_or_targeted added for the Inclusion Strategy wizard's activity table (Word
// export + "Has activity" display) — purely additive, BarriersView/ReportBuilder don't
// reference the field so this doesn't change their behaviour.
export const BARRIER_SELECT = `
  id, description, domain_id, sub_domain_id, student_groups, scale, source,
  status, actions, date_identified, next_review_due, created_at, school_id,
  domains(id, name),
  sub_domains(id, name),
  barrier_provision_points(id, provision_point_id, provision_points(id, label, active, principle, category, universal_or_targeted, sub_domains(id, name, domain_id)))
`
