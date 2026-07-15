-- Session 47 — seeds grp_social_care / grp_young_carer / grp_mental_health_support
-- (and matching reach_* counts) onto existing Springwell/Rydell evidence_entries rows,
-- so the future domain × group matrix has a realistic pattern to show.
-- Candidate rows identified via read-only SELECT and confirmed before this file was written
-- (see TASKS.md Session 47). No new rows created — all UPDATEs target existing evidence_entries
-- by id, tagging on top of whatever groups/reach values already exist on that row.

-- ── Springwell Academy — Mental Health Support (SEND, Wellbeing, Belonging; zero Enrichment) ──
UPDATE evidence_entries SET grp_mental_health_support = true, reach_mental_health_support = 9  WHERE id = '241f5004-3f1c-4e4e-8185-d10efbb4a1db'; -- Wellbeing: MHST Partnership
UPDATE evidence_entries SET grp_mental_health_support = true, reach_mental_health_support = 20 WHERE id = 'dd8e1e0f-1db4-4b3d-8fd0-8b375678defe'; -- Wellbeing: School counsellor
UPDATE evidence_entries SET grp_mental_health_support = true                                   WHERE id = '4acb152d-1f03-40f0-889f-8cb6e54ccdc9'; -- Wellbeing: Senior MH Lead
UPDATE evidence_entries SET grp_mental_health_support = true, reach_mental_health_support = 6  WHERE id = 'a4ba8e11-6851-40a9-a64a-d31ebc2e84a4'; -- Wellbeing: Tiered MH Pathway
UPDATE evidence_entries SET grp_mental_health_support = true, reach_mental_health_support = 10 WHERE id = '1ca19116-08ad-446b-8b0e-0257b6f854ee'; -- SEND: Social skills group (PEERS)
UPDATE evidence_entries SET grp_mental_health_support = true, reach_mental_health_support = 20 WHERE id = '8d928ecb-de2c-4596-927a-48a412eb20a3'; -- SEND: Educational Psychology Service
UPDATE evidence_entries SET grp_mental_health_support = true, reach_mental_health_support = 13 WHERE id = '9330ebf4-b98b-4645-ab1b-c82310d40b1d'; -- Belonging: Trauma-Informed Schools Training
UPDATE evidence_entries SET grp_mental_health_support = true, reach_mental_health_support = 9  WHERE id = '7137e13a-2f5d-4aff-a0e5-9e567327bc28'; -- Belonging: Lunch Club and Social Skills Group

-- ── Springwell Academy — Social Care (Equity, Attendance, SEND; zero Enrichment/Wellbeing) ──
UPDATE evidence_entries SET grp_social_care = true WHERE id = '8b34792e-df18-4260-ac7c-a84938c749c3'; -- Equity: Care-Experienced Pupil Support
UPDATE evidence_entries SET grp_social_care = true WHERE id = '51578ed4-cb69-4bec-bc3b-8dbc7cfd4661'; -- Equity: Family Support Worker
UPDATE evidence_entries SET grp_social_care = true WHERE id = '00d99281-57ac-4001-8ba4-11b19708be70'; -- Equity: Tracking of Ofsted Focus Groups
UPDATE evidence_entries SET grp_social_care = true WHERE id = 'dc87bdaa-f8dd-4ee5-9314-a8abeeb56b18'; -- Attendance: Multi-Agency Child Protection Info Sharing Protocol
UPDATE evidence_entries SET grp_social_care = true WHERE id = 'b030e105-04d8-40ec-96c1-caee4eb2b333'; -- Attendance: Whole-School EBSNA Awareness
UPDATE evidence_entries SET grp_social_care = true WHERE id = '89e22a58-7a26-4d06-bcf8-c8b2c99bf39c'; -- Attendance: EBSNA Lead — SENCo and Pastoral Deputy
UPDATE evidence_entries SET grp_social_care = true WHERE id = '232ee078-3094-49bf-9346-d5259d545e67'; -- SEND: Multi-Agency Review Meetings

-- ── Springwell Academy — Young Carer (Attendance, Belonging; zero Enrichment/Equity) ──
UPDATE evidence_entries SET grp_young_carer = true                              WHERE id = '2ec67d06-60e0-44df-bd55-35994437b9ef'; -- Attendance: Individual Attendance Plans
UPDATE evidence_entries SET grp_young_carer = true                              WHERE id = 'd5d0e922-5812-4e3c-8825-80b772a3ad24'; -- Attendance: Attendance Case Review Meetings
UPDATE evidence_entries SET grp_young_carer = true, reach_young_carer = 8       WHERE id = '5c8edeb8-1cc9-49ef-99ad-4a6fa50b3e36'; -- Attendance: Half-termly Attendance Data Analysis by Group
UPDATE evidence_entries SET grp_young_carer = true, reach_young_carer = 12      WHERE id = 'a2a8b6a3-4ccb-460c-97b6-8e55a070a2be'; -- Belonging: Family Support Worker — 3 days/week
UPDATE evidence_entries SET grp_young_carer = true, reach_young_carer = 6       WHERE id = '4b842185-e6f1-4d35-ae57-d194d7729eb1'; -- Belonging: Home visit programme for persistently absent PP pupils
UPDATE evidence_entries SET grp_young_carer = true                              WHERE id = '62b64ec7-61c3-497c-96cc-28c233102a94'; -- Belonging: Named Trusted Adult Scheme

-- ── Rydell High — sparse, needs-attention pattern (1-2 entries total, SEND/Attendance only) ──
UPDATE evidence_entries SET grp_mental_health_support = true WHERE id = 'e5e4bb37-77f7-4dd7-8c75-735d9b714860'; -- SEND: Educational Psychology Service
UPDATE evidence_entries SET grp_social_care = true            WHERE id = 'dea64480-7733-4b93-8840-30ae68f94c88'; -- Attendance: Designated Attendance Officer
-- grp_young_carer intentionally left untagged (0) across all of Rydell.
