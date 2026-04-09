type EmailParams = {
  to: string
  subject: string
  text: string
  html?: string
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) return null
  return { apiKey, from }
}

export async function sendEmail(params: EmailParams) {
  const cfg = getResendConfig()
  if (!cfg) return { ok: false as const, skipped: true as const }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      process.stderr.write(`email_send_failed:${res.status}:${body}\n`)
      return { ok: false as const }
    }
    return { ok: true as const }
  } catch (err) {
    process.stderr.write(`email_send_error:${err instanceof Error ? err.message : String(err)}\n`)
    return { ok: false as const }
  } finally {
    clearTimeout(timeout)
  }
}

