// Shared between App.jsx and BootstrapWizard.jsx (and anything else that needs them) —
// pulled into their own module to avoid a circular import between the two.

// Compact principle labels — used by the Principle Coverage chart axis and the home page principle cards.
export const PRINCIPLE_LABEL_SHORT = {
  'Leadership & Governance':          'Leadership',
  'Early & Evidence-Based Support':   'Early Support',
  'High Quality Adaptive Teaching':   'Adaptive Teaching',
  'Enriching Provision':              'Enriching Provision',
  'Safe & Respectful Culture':        'Safe Culture',
  'Family & Wider Partnerships':      'Family Partnerships',
  'Accessible & Inclusive Environments': 'Accessible Environments',
}

// Static/declarative points: reminder copy names the linked document and asks if it's still current.
export const STATIC_REVIEW_CATEGORIES = ['Named Person', 'Policy / Published Document']
