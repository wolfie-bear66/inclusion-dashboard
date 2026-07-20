import { useEffect, useState } from 'react'

// Fixed DfE Principles of Inclusion order — must match App.jsx's PRINCIPLES constant.
const PRINCIPLES = [
  'Leadership & Governance',
  'Early & Evidence-Based Support',
  'High Quality Adaptive Teaching',
  'Enriching Provision',
  'Safe & Respectful Culture',
  'Family & Wider Partnerships',
  'Accessible & Inclusive Environments',
]

// Shared fetch + join powering the Principle Coverage analytics tab, the IMF-by-principle
// funding panel, and (from Session 50) the home page principle cards. Extracted from
// AnalyticsView so it can be called again per-school without duplicating the query/join logic.
export function usePrincipleCoverage(sb, schoolId) {
  const [analyticsEntries, setAnalyticsEntries] = useState([])
  const [domains, setDomains] = useState([])
  const [allActivePPs, setAllActivePPs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      sb.from('entries')
        .select(`
          id, provision_point_id, status,
          grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
          provision_points(*, sub_domains(*, domains(id, name))),
          evidence_entries(id, provision_name, indicator_type, provision_category, funding_source, cost, next_review_due,
            evidence_notes, intended_outcomes, impact_on_outcomes, supporting_document_link,
            reach_total, reach_send, reach_pp, reach_eal, reach_fsm, reach_lac, reach_wwc,
            reach_social_care, reach_young_carer, reach_mental_health_support, reach_other,
            grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc,
            grp_social_care, grp_young_carer, grp_mental_health_support, grp_other, evidence_type, structured_detail)
        `)
        .eq('school_id', schoolId),
      sb.from('domains').select('id, name, display_order').order('display_order'),
      sb.from('provision_points').select('id, principle, display_order').eq('active', true),
    ]).then(([entriesRes, domainsRes, ppsRes]) => {
      if (entriesRes.error) console.error('Analytics entries error:', entriesRes.error)
      if (domainsRes.error) console.error('Analytics domains error:', domainsRes.error)
      setAnalyticsEntries(entriesRes.data ?? [])
      setDomains(domainsRes.data ?? [])
      setAllActivePPs(ppsRes.data ?? [])
      setLoading(false)
    })
  }, [sb, schoolId])

  // Principle Coverage — join active PPs with entry statuses
  const entryStatusMap = Object.fromEntries(analyticsEntries.map(e => [e.provision_point_id, e.status]))
  const principleData = PRINCIPLES.map(principle => {
    const pps = allActivePPs.filter(pp => pp.principle === principle)
    const inPlace    = pps.filter(pp => entryStatusMap[pp.id] === 'in_place').length
    const inProgress = pps.filter(pp => entryStatusMap[pp.id] === 'in_progress').length
    const notInPlace = pps.filter(pp => !entryStatusMap[pp.id] || entryStatusMap[pp.id] === 'not_in_place').length
    return { principle, total: pps.length, inPlace, inProgress, notInPlace }
  })

  return { analyticsEntries, domains, allActivePPs, principleData, loading }
}
