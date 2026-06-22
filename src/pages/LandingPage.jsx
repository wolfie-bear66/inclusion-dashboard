import { useState } from 'react'
import './LandingPage.css'

const DEMO_URL = 'https://inclusion-dashboard.vercel.app/demo'
const MAILTO = 'mailto:hello@inclusiondashboard.co.uk?subject=Inclusion%20Dashboard%20Demo%20Request'
const FORMSPREE = 'https://formspree.io/f/mdavvadd'

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function ContactForm({ enquiryType, btnClass, btnLabel }) {
  const [fields, setFields] = useState({ name: '', role: '', org: '', email: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | submitting | success | error

  function set(key, val) { setFields(prev => ({ ...prev, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('submitting')
    try {
      const res = await fetch(FORMSPREE, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.name,
          role: fields.role,
          organisation: fields.org,
          email: fields.email,
          message: fields.message,
          enquiry_type: enquiryType,
        }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="lp-form__success">
        <span className="lp-form__success-icon">✓</span>
        <p>Thanks — we'll be in touch shortly.</p>
      </div>
    )
  }

  const isNavy = enquiryType === 'mat'

  return (
    <form className="lp-form" onSubmit={handleSubmit} noValidate>
      <div className="lp-form__row">
        <input
          className={`lp-form__input${isNavy ? ' lp-form__input--navy' : ''}`}
          type="text" placeholder="Your name" required
          value={fields.name} onChange={e => set('name', e.target.value)}
        />
        <input
          className={`lp-form__input${isNavy ? ' lp-form__input--navy' : ''}`}
          type="text" placeholder="Your role" required
          value={fields.role} onChange={e => set('role', e.target.value)}
        />
      </div>
      <input
        className={`lp-form__input${isNavy ? ' lp-form__input--navy' : ''}`}
        type="text" placeholder="School or trust name" required
        value={fields.org} onChange={e => set('org', e.target.value)}
      />
      <input
        className={`lp-form__input${isNavy ? ' lp-form__input--navy' : ''}`}
        type="email" placeholder="Email address" required
        value={fields.email} onChange={e => set('email', e.target.value)}
      />
      <textarea
        className={`lp-form__input lp-form__textarea${isNavy ? ' lp-form__input--navy' : ''}`}
        placeholder="Anything you'd like us to know? (optional)"
        value={fields.message} onChange={e => set('message', e.target.value)}
      />
      {status === 'error' && (
        <p className="lp-form__error">Something went wrong — please try again or email us directly.</p>
      )}
      <button
        type="submit"
        className={`lp-cta-card__btn ${btnClass}`}
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? 'Sending…' : btnLabel}
      </button>
    </form>
  )
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState(0)

  const tabs = [
    {
      label: '1. Record',
      body: 'Log everything your school does for inclusion — with the evidence behind it, the costs, and the outcomes. Your team can contribute across their areas of responsibility, with an approval layer to ensure accuracy. Review dates are tracked and you\'ll be reminded when they\'re due.',
      img: '/images/landing/howitworks-evidence.png',
      imgAlt: 'Evidence modal showing data entry fields for evidence, cost, outcomes, and document links',
    },
    {
      label: '2. Analyse',
      body: 'As your provision picture builds, the gaps become visible. See where provision is strong and where it\'s thin — and crucially, see which student groups are underserved. FSM, SEND, EAL, care-experienced — the dashboard shows you where support isn\'t reaching the pupils who need it most.',
      imgAlt: 'Analytics screen showing Domain Readiness chart and gap analysis view',
      demoLink: true,
    },
    {
      label: '3. Report',
      body: 'Generate a formatted PDF export ready to use as the foundation of your statutory Inclusion Strategy. Scope your report for different audiences — a full compliance document for governors, a focused summary for a specific domain, or a funding breakdown for your trust.',
      img: '/images/landing/howitworks-report.png',
      imgAlt: 'PDF export preview showing landscape layout with school context and domain readiness',
    },
  ]

  const domains = [
    {
      name: 'SEND Support & Needs',
      desc: 'From identification through to specialist provision — structured around the white paper\'s emerging four-tier model, with evidence attached at every stage.',
      borderColor: 'var(--domain-send-text)',
      textColor: 'var(--domain-send-text)',
    },
    {
      name: 'Equity & Disadvantage',
      desc: 'Pupil premium strategy, barriers analysis, and targeted support for your most underserved pupils — with disadvantage funding reform on the horizon, knowing exactly where your provision stands has never mattered more.',
      borderColor: 'var(--domain-equity-text)',
      textColor: 'var(--domain-equity-text)',
    },
    {
      name: 'Attendance & Engagement',
      desc: 'From first-day absence processes through to complex non-attendance — including the white paper\'s new statutory duties around reintegration and behaviour support. Record your systems, evidence your interventions, and demonstrate a consistent whole-school approach.',
      borderColor: 'var(--domain-attendance-text)',
      textColor: 'var(--domain-attendance-text)',
    },
    {
      name: 'Enrichment',
      desc: 'Civic engagement, arts and culture, nature and outdoors, sport, and wider life skills — the Enrichment Framework is due in 2026. Record what you offer, identify which student groups are accessing it, and evidence that enrichment is genuinely available to all.',
      borderColor: 'var(--domain-enrichment-text)',
      textColor: 'var(--domain-enrichment-text)',
    },
    {
      name: 'Belonging',
      desc: 'From relational safety and peer relationships through to pupil voice and family engagement — the white paper\'s Pupil Engagement Framework makes belonging a statutory concern, not just a pastoral one. Evidence the culture your school has built and identify where it needs strengthening.',
      borderColor: 'var(--domain-belonging-text)',
      textColor: 'var(--domain-belonging-text)',
    },
    {
      name: 'Wellbeing',
      desc: 'From ethos and climate through to mental health support and behaviour as communication — wellbeing is now a whole-school statutory expectation, not a bolt-on. Record your provision, evidence your Senior Mental Health Lead\'s role, and demonstrate a coherent approach from culture to crisis support.',
      borderColor: 'var(--domain-wellbeing-text)',
      textColor: 'var(--domain-wellbeing-text)',
    },
  ]

  return (
    <>
      {/* ── Nav ── */}
      <nav className="lp-nav">
        <a className="lp-nav__wordmark" href="/">Inclusion Dashboard</a>
        <div className="lp-nav__actions">
          <a className="lp-btn-ghost" href={DEMO_URL}>
            Try the demo
          </a>
          <a className="lp-btn-ghost" href="/login">Sign in</a>
          <button className="lp-btn-primary" onClick={() => scrollTo('cta-section')}>
            Book a demo
          </button>
        </div>
      </nav>

      {/* ── Section 1: Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero__eyebrow-pill">Ahead of the 2028–29 statutory deadline</div>
        <h1 className="lp-hero__h1">Inclusion, evidenced in full.</h1>
        <p className="lp-hero__sub">
          See every gap, organise improvements, report with confidence.
        </p>
        <div className="lp-hero__cta-row">
          <button className="lp-btn-primary" onClick={() => scrollTo('cta-section')}>Book a demo</button>
          <button className="lp-btn-ghost" onClick={() => scrollTo('how-it-works')}>
            See how it works ↓
          </button>
        </div>
        <p className="lp-hero__trust">
          Built for the Every Child Achieving and Thriving white paper (February 2026)
        </p>
        <img
          src="/images/landing/hero-home.png"
          alt="Inclusion Dashboard home screen showing domain readiness overview for Springwell Academy"
          className="lp-hero__img"
          style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block' }}
        />
      </section>

      {/* ── Section 3: Problem ── */}
      <section className="lp-problem">
        <p className="lp-problem__eyebrow">The problem</p>
        <h2 className="lp-problem__h2">
          Inclusion now spans SEND, attendance, enrichment, belonging, wellbeing, and disadvantage.
          Most schools can't tell you what they've got across all six.
        </h2>
        <div className="lp-problem__body">
          <p>
            The Every Child Achieving and Thriving white paper doesn't just reform SEND. It reframes
            inclusion across attendance, enrichment, belonging, wellbeing, and disadvantage — and a
            statutory Inclusion Strategy is due by 2028–29.
          </p>
          <p>
            Right now, most schools are managing this across a dozen spreadsheets, last year's SEN
            Information Report, and whatever their assistant head built in PowerPoint. When Ofsted asks,
            or when the deadline arrives, the scramble starts again.
          </p>
        </div>
        <div className="lp-problem__quotes">
          <div className="lp-quote-card">
            <p className="lp-quote-card__text">
              "Every time I write an inclusion report, I have to start from scratch."
            </p>
            <p className="lp-quote-card__attr">— Assistant Headteacher, secondary school</p>
          </div>
          <div className="lp-quote-card">
            <p className="lp-quote-card__text">
              "When our SENCO left, we realised how much existed only in her head. We had no clear record
              of what was in place, what had been tried, or who was supposed to be doing what."
            </p>
            <p className="lp-quote-card__attr">— Deputy Headteacher, secondary school</p>
          </div>
          <div className="lp-quote-card">
            <p className="lp-quote-card__text">
              "Inclusion touches so many different areas and so many different people. It's genuinely hard
              to be confident that nothing is being missed until something forces you to look."
            </p>
            <p className="lp-quote-card__attr">— Headteacher, primary school</p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Solution ── */}
      <section className="lp-solution">
        <div className="lp-solution__inner">
          <div>
            <p className="lp-eyebrow">The solution</p>
            <h2 className="lp-solution__h2">Record what you have. Evidence it. Know what's missing.</h2>
            <p className="lp-solution__body">
              The Inclusion Dashboard gives your school one place to record your inclusion provision,
              attach the evidence behind it, and track when reviews are due. As your picture builds,
              gaps become visible — across provision areas and across the student groups who need
              support most.
            </p>
            <ul className="lp-solution__no-list">
              <li>No starting from scratch.</li>
              <li>No spreadsheet archaeology.</li>
              <li>No compliance guesswork.</li>
            </ul>
          </div>
          <img
            src="/images/landing/solution-belonging.png"
            alt="Belonging domain detail screen showing provision point rows with status indicators"
            className="lp-solution__img"
            style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block' }}
          />
        </div>
      </section>

      {/* ── Section 5: How It Works ── */}
      <section className="lp-how" id="how-it-works">
        <h2 className="lp-how__headline">
          From scattered provision to statutory confidence — in three steps
        </h2>
        <div className="lp-how__tabs">
          <div className="lp-how__tab-list">
            {tabs.map((t, i) => (
              <button
                key={i}
                className={`lp-how__tab-btn${activeTab === i ? ' active' : ''}`}
                onClick={() => setActiveTab(i)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="lp-how__tab-panel">
            <p className="lp-how__tab-body">{tabs[activeTab].body}</p>
            {tabs[activeTab].img && (
              <img
                src={tabs[activeTab].img}
                alt={tabs[activeTab].imgAlt}
                className="lp-how__tab-img"
                style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block' }}
              />
            )}
            {tabs[activeTab].demoLink && (
              <a className="lp-how__demo-link" href={DEMO_URL}>
                See it live — explore the Springwell Academy demo →
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Section 6: Six Domains Bento ── */}
      <section className="lp-domains">
        <h2 className="lp-domains__headline">Every aspect of inclusion, in one place.</h2>
        <p className="lp-domains__sub">
          The white paper reframes inclusion far beyond SEND — across enrichment, attendance, belonging,
          wellbeing, and disadvantage. The dashboard covers all of it.
        </p>
        <div className="lp-domains__grid">
          {domains.map((d, i) => (
            <div
              key={i}
              className="lp-domain-card"
              style={{ borderTop: `4px solid ${d.borderColor}` }}
            >
              <h3 className="lp-domain-card__name" style={{ color: d.textColor }}>{d.name}</h3>
              <p className="lp-domain-card__desc">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 7: MAT / Trust ── */}
      <section className="lp-mat">
        <div className="lp-mat__inner">
          <div>
            <p className="lp-eyebrow">For multi-academy trusts</p>
            <h2 className="lp-mat__h2">One decision. Every school in your trust, covered.</h2>
            <p className="lp-mat__body">
              The Inclusion Dashboard includes a trust-level view — compare provision readiness across
              every school, identify where support is needed most, and track compliance progress
              trust-wide. With Ofsted now inspecting trusts as whole entities, consistent inclusion
              standards across every school isn't just good practice — it's a strategic necessity.
            </p>
            <div className="lp-mat__callouts">
              {[
                'Every school in your trust, visible in one view',
                'RAG status across all schools at a glance',
                'Identify which schools need support before Ofsted does',
                'Dive deep into any school to see their full provision picture',
              ].map((text, i) => (
                <div key={i} className="lp-mat__callout">{text}</div>
              ))}
            </div>
          </div>
          <div className="img-placeholder lp-mat__img">
            [Screenshot: MAT dashboard — RAG school pills and domain comparison chart]
          </div>
        </div>
      </section>

      {/* ── Section 8: Testimonial ── */}
      <section className="lp-testimonial">
        <p className="lp-testimonial__quote">
          "For the first time, I can see exactly what we have in place, where the gaps are, and who
          owns what. That clarity is genuinely valuable."
        </p>
        <p className="lp-testimonial__attr">— Headteacher · Secondary school</p>
      </section>

      {/* ── Section 10: CTA / Pricing ── */}
      <section className="lp-cta" id="cta-section">
        <h2 className="lp-cta__h2">Start before the deadline does</h2>
        <p className="lp-cta__sub">
          Inclusion compliance isn't a one-off task, it's a reflection of your school culture. The
          schools that will be ready are the ones that start managing it continuously now.
        </p>
        <div className="lp-cta__cards">
          <div className="lp-cta-card">
            <h3 className="lp-cta-card__label">Single school</h3>
            <p className="lp-cta-card__sub">
              For headteachers who want clarity on the Inclusion vision
            </p>
            <ContactForm
              enquiryType="school"
              btnClass="lp-cta-card__btn--primary"
              btnLabel="Book a demo"
            />
            <p className="lp-cta-card__note">
              Limited early adopter places available for the 2026–27 academic year
            </p>
          </div>
          <div className="lp-cta-card lp-cta-card--navy">
            <h3 className="lp-cta-card__label">Multi-academy trust</h3>
            <p className="lp-cta-card__sub">
              For trust leaders who want coverage across every school
            </p>
            <ContactForm
              enquiryType="mat"
              btnClass="lp-cta-card__btn--white"
              btnLabel="Talk to us"
            />
            <p className="lp-cta-card__note">
              One conversation. Every school in your trust onboarded.
            </p>
          </div>
        </div>
        <p className="lp-cta__gdpr">No named pupil data required at any stage.</p>
      </section>

      {/* ── Section 11: Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div>
            <p className="lp-footer__wordmark">Inclusion Dashboard</p>
            <p className="lp-footer__tagline">Your inclusion provision, in one place.</p>
          </div>
          <nav className="lp-footer__nav">
            <a href={DEMO_URL}>Demo</a>
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
            <a href={MAILTO}>Contact</a>
          </nav>
          <p className="lp-footer__small">
            Built for English state schools. Aligned to the Every Child Achieving and Thriving white
            paper (February 2026).
          </p>
        </div>
      </footer>
    </>
  )
}
