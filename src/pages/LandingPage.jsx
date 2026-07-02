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
      label: '1. Assign',
      body: 'Your Inclusion Lead identifies ownership of provision across the school, so every point from "Every Child Achieving and Thriving" (2026) has a named person responsible for it from day one — no more provision sitting in nobody\'s inbox.',
      img: '/images/landing/step1-assign.png',
      imgAlt: 'Provision ownership assignment screen showing named responsibility for each provision point',
    },
    {
      label: '2. Evidence',
      body: 'Each contributor evidences their own provision as they go — logging what\'s in place, the costs, and the outcomes, live rather than reconstructed at report time. An approval layer ensures accuracy before anything counts as complete, and review dates are tracked automatically so you\'re reminded when they\'re due.',
      img: '/images/landing/howitworks-evidence.png',
      imgAlt: 'Evidence modal showing data entry fields for evidence, cost, outcomes, and document links',
    },
    {
      label: '3. Identify Barriers',
      body: 'Inclusion Dashboard follows the EEF\'s evidence-informed implementation cycle — barrier identification sits at its centre. Record what\'s stopping students from full participation, what\'s being done to address it, and set review dates to track whether it\'s worked. At trust level, barriers surface across all schools so leaders can spot shared patterns and spread what\'s working.',
      img: '/images/landing/barriers-dashboard.png',
      imgAlt: 'Barriers view',
    },
    {
      label: '4. Build the Strategy',
      body: 'As your evidence builds, your statutory strategy drafts itself — organised by the DfE\'s 7 Principles of Inclusion, not a blank page. Gaps become visible as you go: where provision is strong, where it\'s thin, and which student groups are underserved. FSM, SEND, EAL, care-experienced — you can see where support isn\'t reaching the pupils who need it most.',
      img: '/images/landing/step4-build-strategy.png',
      imgAlt: 'Strategy builder screen organised by the DfE\'s 7 Principles of Inclusion',
    },
    {
      label: '5. Report',
      body: 'Use your live evidence to generate a formatted PDF export ready to use as your statutory Inclusion Strategy. Alternatively, create your own Inclusion Report for different audiences — a full compliance document for governors, a focused summary for a specific domain, or a funding breakdown for your trust.',
      img: '/images/landing/report-dashboard.png',
      imgAlt: 'PDF export preview showing landscape layout with school context and domain readiness',
    },
    {
      label: '6. Review',
      body: 'Outcomes are checked against intent, year on year — a comparison, not a rewrite. Next year\'s strategy starts from evidence, not a blank page, closing the loop back to Assign.',
      img: '/images/landing/cycle-diagram-six-steps.png',
      imgAlt: 'Six-step Inclusion Dashboard cycle diagram: Assign, Evidence, Identify Barriers, Build the Strategy, Report, Review, looping back to Assign',
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
          <a className="lp-btn-primary" href={DEMO_URL}>
            Try the demo
          </a>
          <a className="lp-nav__link" href="#contact">Get in touch</a>
          <a className="lp-btn-ghost" href="/login">Sign in</a>
        </div>
      </nav>

      {/* ── Section 1: Hero ── */}
      <section className="lp-hero">
        <div style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '6px 14px',
          borderRadius: '20px',
          background: '#FDF3E3',
          border: '1px solid #EF9F27',
          color: '#854F0B',
          marginBottom: '28px',
        }}>
          Inclusion Strategy Deadline: 31 December 2026
        </div>
        <h1 className="lp-hero__h1" style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: '72px',
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
        }}>
          <span style={{ color: '#1B365D' }}>Inclusion,</span><br />
          <span style={{ color: '#C45C1A' }}>evidenced in full.</span>
        </h1>
        <p className="lp-hero__sub" style={{ fontSize: '19px', lineHeight: 1.65 }}>
          See the gaps, act on them, report with confidence.
        </p>

        <div className="lp-hero__cta-row">
          <a className="lp-btn-primary lp-hero__cta-btn" href="/demo">
            Explore the live demo →
          </a>
        </div>

        <div style={{ position: 'relative', maxWidth: '1100px', margin: '3rem auto 0' }}>
          <a href="/demo" style={{ display: 'block', position: 'relative', cursor: 'pointer' }}>
            <img
              src="/hero-dashboard.png"
              alt="Inclusion Dashboard — MAT and school dashboards side by side"
              style={{ width: '100%', borderRadius: '12px', display: 'block' }}
            />
            <div className="hero-image-overlay">
              Explore the live demo →
            </div>
          </a>
        </div>
      </section>

      {/* ── Section 3: Problem ── */}
      <section className="lp-problem">
        <p className="lp-problem__eyebrow">The problem</p>
        <h2 className="lp-problem__h2">
          The challenge schools are navigating
        </h2>
        <div className="lp-problem__body">
          <p>
            The DfE's new framework asks schools to evidence inclusion across 7 principles — from adaptive teaching and enriching provision to belonging, wellbeing, and family partnerships. That's a genuinely broad picture, and most schools are still working out what they have, where the gaps are, and how to show it.
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
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 16, lineHeight: 1.55 }}>
              Structured around the EEF's implementation guidance and the DfE's Inclusion Strategy requirements.
            </p>
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
          How Inclusion Dashboard works — one continuous cycle
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
            {tabs[activeTab].heading && (
              <h3 className="lp-how__tab-heading">{tabs[activeTab].heading}</h3>
            )}
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
                Try a live demo — start with the MAT overview →
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
            <h2 className="lp-mat__h2">Built for MATs — see every school at a glance</h2>
            <p className="lp-mat__body">
              For multi-academy trust directors and inclusion leads, Inclusion Dashboard gives you a live
              picture of compliance across your whole trust. Spot which schools are on track and which
              need support — before Ofsted does. One dashboard. Every school. No spreadsheets.
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
            <div style={{ marginTop: 24 }}>
              <a
                href={DEMO_URL}
                className="lp-btn-ghost"
                style={{ display: 'inline-block' }}
              >
                See it in the demo →
              </a>
            </div>
          </div>
          <img
            src="/mat-dashboard.png"
            alt="MAT dashboard showing RAG status across all schools in the trust"
            style={{ width: '100%', borderRadius: 12, display: 'block' }}
          />
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

      {/* ── Section 10: Contact ── */}
      <section id="contact" style={{ background: '#F7F8FA', padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', marginBottom: '12px' }}>
          GET IN TOUCH
        </p>
        <h2 style={{ fontSize: '32px', fontWeight: '700', color: '#1B365D', marginBottom: '16px' }}>
          Built by a teacher, for teachers
        </h2>
        <p style={{ fontSize: '16px', color: '#4B5563', maxWidth: '560px', margin: '0 auto 32px', lineHeight: '1.6' }}>
          I'm Stuart — a secondary school science teacher who built Inclusion Dashboard from inside a school.
          If you'd like to know more, try the tool, or talk about what it could look like in your school or trust,
          I'd love to hear from you.
        </p>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <ContactForm
            enquiryType="school"
            btnClass="lp-cta-card__btn--primary"
            btnLabel="Send message"
          />
        </div>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '24px' }}>
          Or email directly: <a href="mailto:hello@inclusiondashboard.co.uk" style={{ color: '#1B365D' }}>hello@inclusiondashboard.co.uk</a>
        </p>
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
