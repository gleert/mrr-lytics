import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Simple rate limiting: max 3 submissions per IP per hour (stored in memory, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }

  if (entry.count >= 3) return true

  entry.count++
  return false
}

function getCorsHeaders() {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'https://mrrlytics.com,https://www.mrrlytics.com')
    .split(',').map(o => o.trim())

  return {
    'Access-Control-Allow-Origin': allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() })
}

export async function POST(request: NextRequest) {
  const headers = getCorsHeaders()

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers }
      )
    }

    const body = await request.json()
    const { name, email, subject, message, lang = 'en' } = body

    // Validate
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'All fields are required.' },
        { status: 400, headers }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address.' },
        { status: 400, headers }
      )
    }

    if (message.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Message is too short.' },
        { status: 400, headers }
      )
    }

    const supabase = createAdminClient()

    // Save to database
    const { error: insertError } = await supabase
      .from('contact_messages')
      .insert({
        name: name.trim().substring(0, 200),
        email: email.trim().toLowerCase().substring(0, 200),
        subject: subject.trim().substring(0, 500),
        message: message.trim().substring(0, 5000),
        lang,
        ip,
      })

    if (insertError) {
      console.error('[contact] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to save message. Please try again.' },
        { status: 500, headers }
      )
    }

    // Send notification email via SMTP if configured
    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || '465'),
          secure: (process.env.SMTP_PORT || '465') === '465',
          auth: { user: smtpUser, pass: smtpPass },
        })

        await transporter.sendMail({
          from: process.env.SMTP_FROM || `MRRlytics Contact <${smtpUser}>`,
          to: process.env.CONTACT_EMAIL || 'hello@mrrlytics.com',
          replyTo: email.trim(),
          subject: `[Contact] ${subject.trim()}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8b5cf6;">New contact message</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold; width: 100px;">Name:</td><td>${name}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td><a href="mailto:${email}">${email}</a></td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Subject:</td><td>${subject}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Lang:</td><td>${lang}</td></tr>
              </table>
              <hr style="margin: 16px 0; border-color: #e5e7eb;" />
              <p style="white-space: pre-wrap; color: #374151;">${message}</p>
              <hr style="margin: 16px 0; border-color: #e5e7eb;" />
              <p style="font-size: 12px; color: #9ca3af;">Sent from mrrlytics.com contact form · IP: ${ip}</p>
            </div>
          `,
        })
      } catch (emailErr) {
        // Don't fail the request if email fails - message is already saved
        console.error('[contact] Email notification failed:', emailErr)
      }
    }

    console.log(`[contact] New message from ${email} (${ip}): ${subject}`)

    return NextResponse.json(
      { success: true, message: 'Message sent successfully.' },
      { status: 200, headers }
    )
  } catch (err) {
    console.error('[contact] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500, headers }
    )
  }
}
