// Shared by onboard-school, invite-user, and resend-invite: generates a temporary
// password for a new/reissued account and emails it as plain text (no clickable link),
// so nothing gets consumed by school email-security link scanners before the real
// recipient opens it. See Phase 1 plan: replace magic-link invites with temp-password
// onboarding.

// Characters chosen to be easy to read/type and to avoid visually ambiguous glyphs:
// no 0/O, no 1/l/I, no o.
const TEMP_PASSWORD_CHARSET = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',   // no I, O
  lower: 'abcdefghjkmnpqrstuvwxyz',    // no l, o
  digit: '23456789',                  // no 0, 1
}

function randomChar(charset: string): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return charset[bytes[0] % charset.length]
}

// 12 characters, human-typeable, and guaranteed to contain at least one upper/lower/digit
// so it clears Supabase's default password strength requirements regardless of project config.
export function generateTempPassword(): string {
  const all = TEMP_PASSWORD_CHARSET.upper + TEMP_PASSWORD_CHARSET.lower + TEMP_PASSWORD_CHARSET.digit
  const length = 12

  const required = [
    randomChar(TEMP_PASSWORD_CHARSET.upper),
    randomChar(TEMP_PASSWORD_CHARSET.lower),
    randomChar(TEMP_PASSWORD_CHARSET.digit),
  ]
  const rest = Array.from({ length: length - required.length }, () => randomChar(all))

  const chars = [...required, ...rest]
  // Fisher-Yates shuffle so the required characters aren't always in the first 3 slots.
  for (let i = chars.length - 1; i > 0; i--) {
    const bytes = new Uint32Array(1)
    crypto.getRandomValues(bytes)
    const j = bytes[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export interface SendTempPasswordEmailArgs {
  to: string
  firstName: string
  schoolName: string
  tempPassword: string
}

const FROM_ADDRESS = 'Inclusion Dashboard <hello@inclusiondashboard.co.uk>'

// FLAGGED FOR STUART: placeholder pending confirmation of the real production login URL.
const LOGIN_URL = 'https://inclusiondashboard.co.uk/login'

function buildEmail({ firstName, schoolName, tempPassword }: SendTempPasswordEmailArgs) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const subject = `Your Inclusion Dashboard login for ${schoolName}`
  const text = [
    greeting,
    '',
    `You've been set up with an Inclusion Dashboard account for ${schoolName}.`,
    '',
    `Log in at ${LOGIN_URL} with your email address and this temporary password:`,
    '',
    `    ${tempPassword}`,
    '',
    "You'll be asked to set your own permanent password the first time you log in.",
    '',
    'This temporary password expires in 7 days if unused — after that, ask your school admin to send you a new one.',
  ].join('\n')

  return { subject, text }
}

// Throws on any failure (missing API key, network error, non-2xx from Resend) so callers
// surface it the same way they already surface auth errors, rather than failing silently.
export async function sendTempPasswordEmail(args: SendTempPasswordEmailArgs): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    throw new Error('Server misconfiguration: missing RESEND_API_KEY')
  }

  const { subject, text } = buildEmail(args)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: args.to,
      subject,
      text,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend API error (${res.status}): ${body || res.statusText}`)
  }
}
