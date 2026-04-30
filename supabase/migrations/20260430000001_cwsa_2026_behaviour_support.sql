-- Migration: Provision point updates for Children's Wellbeing and Schools Act 2026
-- Royal Assent: 29 April 2026
-- Domain: Attendance & Engagement / Sub-domain: Behaviour Support

-- Change 1: Strengthen internal suspension wording to reflect statutory default
UPDATE provision_points
SET label = 'Internal suspension provision as statutory default before home exclusion'
WHERE label = 'Internal suspension provision';

-- Change 2: Extend off-rolling monitoring to include CNIS notification duties
UPDATE provision_points
SET label = 'Monitoring of Off-Rolling and compliance with Children Not in School notification duties to local authority'
WHERE label = 'Monitoring of Off-Rolling';

-- Change 3: Add statutory information sharing provision point
-- Inserted after "Engagement with external agencies" (currently last in sub-domain)
INSERT INTO provision_points (label, display_order, sub_domain_id)
SELECT
  'Documented process for statutory information sharing with multi-agency child protection teams',
  COALESCE((
    SELECT MAX(pp2.display_order)
    FROM provision_points pp2
    WHERE pp2.sub_domain_id = sd.id
  ), 0) + 1,
  sd.id
FROM sub_domains sd
JOIN domains d ON sd.domain_id = d.id
WHERE sd.name = 'Behaviour Support'
  AND d.name ILIKE '%Attendance%';

-- Change 4: Add statutory mobile phone policy provision point
-- Inserted after Change 3 above
INSERT INTO provision_points (label, display_order, sub_domain_id)
SELECT
  'Statutory mobile phone policy published, communicated and consistently enforced',
  COALESCE((
    SELECT MAX(pp2.display_order)
    FROM provision_points pp2
    WHERE pp2.sub_domain_id = sd.id
  ), 0) + 1,
  sd.id
FROM sub_domains sd
JOIN domains d ON sd.domain_id = d.id
WHERE sd.name = 'Behaviour Support'
  AND d.name ILIKE '%Attendance%';
