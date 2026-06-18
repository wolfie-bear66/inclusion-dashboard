import './LandingPage.css'
import './AboutPage.css'

const DEMO_URL = 'https://inclusion-dashboard.vercel.app/demo'

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export default function AboutPage() {
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
        <p className="static-page__eyebrow">About</p>
        <h1 className="static-page__h1">About Inclusion Dashboard</h1>

        <div className="static-page__body">
          <p>
            I spent 21 years in the classroom as a science teacher, and for much of that time I held
            two roles that don't always sit together easily — Head of Science and SEND Curriculum Lead.
          </p>
          <p>
            That combination taught me something important. The schools that do inclusion well aren't
            the ones with the most resources or the most elaborate systems. They're the ones where
            nobody falls through the gaps — where staff know the whole picture, and where no student
            goes unnoticed simply because the information about them existed somewhere nobody thought
            to look.
          </p>
          <p>
            The problem isn't that schools don't care. It's that inclusion is genuinely hard to hold
            together. It spans SEND, attendance, enrichment, belonging, wellbeing, disadvantage — and
            that's before you account for all the other demands on a school's time and attention. When
            provision lives across a dozen systems, a handful of spreadsheets, and the institutional
            memory of whoever currently holds each role, things get missed. Not because anyone failed
            — but because the picture was never visible in one place.
          </p>
          <p>
            I was already working on several projects around belonging and inclusion when the Every
            Child Achieving and Thriving white paper was published in February 2026. Reading it felt
            less like a new direction and more like a moment of clarity. The Inclusion Dashboard grew
            out of those projects — a way to bring everything under one roof, make the gaps visible,
            and give schools the evidence they need to tell their inclusion story with confidence.
          </p>
          <p>
            But compliance was never the point. The framework matters, the deadlines matter, and the
            statutory requirements matter — but they're a floor, not a ceiling.
          </p>
          <p>
            What I'm really trying to build is a tool that helps schools move from inclusion as a
            service that meets expectations, to inclusion as something closer to hospitality. The best
            schools I've worked in and visited don't just provide for students — they create an
            experience of belonging that students carry with them long after they leave. An experience
            that sets them on their way to becoming adults who feel at home in the wider world.
          </p>
          <p>
            That's worth more than a ticked box. And it starts with knowing, clearly and honestly,
            where you stand.
          </p>

          <p className="static-page__signoff">
            Stuart Yates{'\n\n'}Founder, Inclusion Dashboard
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
            <a href="mailto:yatesstuart66@gmail.com?subject=Inclusion%20Dashboard%20Demo%20Request">Contact</a>
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
