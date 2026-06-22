import './LandingPage.css'
import './AboutPage.css'
import './PrivacyPage.css'

const DEMO_URL = 'https://inclusion-dashboard.vercel.app/demo'

export default function PrivacyPage() {
  return (
    <div className="static-page">
      {/* ── Nav ── */}
      <nav className="lp-nav">
        <a className="lp-nav__wordmark" href="/">Inclusion Dashboard</a>
        <div className="lp-nav__actions">
          <a className="lp-btn-ghost" href={DEMO_URL}>Try the demo</a>
          <a className="lp-btn-ghost" href="/login">Sign in</a>
          <a className="lp-btn-primary" href="/#cta-section">Book a demo</a>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="static-page__body">
        <h1 className="static-page__h1">Privacy Policy</h1>
        <p className="privacy-page__meta">Last updated: June 2026</p>

        <div className="privacy-page__section">
          <h3>Who we are</h3>
          <p>
            Inclusion Dashboard is a web-based compliance tool for schools and multi-academy trusts
            in England, built to support statutory inclusion planning under the Every Child Achieving
            and Thriving white paper (February 2026). It is operated by Stuart Yates, based in
            England.
          </p>
          <p>
            If you have any questions about this policy, contact us at{' '}
            <a href="mailto:hello@inclusiondashboard.co.uk">hello@inclusiondashboard.co.uk</a>
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>What data we collect</h3>
          <p>
            Inclusion Dashboard collects only the data necessary to operate the service. We do not
            require named pupil data at any stage.
          </p>
          <span className="privacy-page__subheading">Account data</span>
          <p>
            When you create an account we collect your name, email address, job title, and school or
            trust name.
          </p>
          <span className="privacy-page__subheading">Provision data</span>
          <p>
            The dashboard stores information about your school's inclusion provision — policies,
            processes, evidence documents, costs, and outcomes. This is institutional data about what
            your school does, not data about individual pupils.
          </p>
          <span className="privacy-page__subheading">Usage data</span>
          <p>
            We collect basic usage information such as login activity and feature use to help us
            improve the product. This data is not shared with third parties.
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>How we use your data</h3>
          <p>
            We use your data solely to provide and improve the Inclusion Dashboard service. We do not
            sell your data, share it with advertisers, or use it for any purpose unrelated to the
            service.
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>Where your data is stored</h3>
          <p>
            Your data is stored securely on Supabase, hosted on AWS infrastructure in the EU
            (Ireland). This means your data remains within the European Economic Area and is subject
            to EU data protection standards, which are recognised as adequate under UK GDPR.
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>Your rights under UK GDPR</h3>
          <p>As a user of Inclusion Dashboard you have the right to:</p>
          <ul className="privacy-page__list">
            <li>Access the data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Object to or restrict how we process your data</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:hello@inclusiondashboard.co.uk">hello@inclusiondashboard.co.uk</a>. We will respond
            within 30 days.
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>Data retention</h3>
          <p>
            We retain your account and provision data for as long as your account is active. If you
            close your account, your data will be deleted within 30 days unless we are required to
            retain it for legal reasons.
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>Cookies</h3>
          <p>
            Inclusion Dashboard uses only essential cookies necessary for authentication and session
            management. We do not use advertising or tracking cookies.
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>Changes to this policy</h3>
          <p>
            We may update this policy as the product develops. We will notify users of any
            significant changes by email.
          </p>
        </div>

        <div className="privacy-page__section">
          <h3>Contact</h3>
          <p className="privacy-page__contact">
            Stuart Yates<br />
            <a href="mailto:hello@inclusiondashboard.co.uk">hello@inclusiondashboard.co.uk</a><br />
            Inclusion Dashboard — inclusiondashboard.co.uk
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
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
            <a href="mailto:hello@inclusiondashboard.co.uk?subject=Inclusion%20Dashboard%20Demo%20Request">Contact</a>
          </nav>
          <p className="lp-footer__small">
            Built for English state schools. Aligned to the Every Child Achieving and Thriving white
            paper (February 2026).
          </p>
        </div>
      </footer>
    </div>
  )
}
