import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const LINE_REPLY_API = 'https://api.line.me/v2/bot/message/reply'

// Verify LINE signature for security
function verifySignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelSecret) {
    console.warn('LINE_CHANNEL_SECRET not configured')
    return true // Allow in dev mode
  }

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64')

  return hash === signature
}

// Reply to LINE message
async function replyMessage(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return

  await fetch(LINE_REPLY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-line-signature') || ''

    // Verify signature
    if (!verifySignature(body, signature)) {
      console.error('Invalid LINE signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const data = JSON.parse(body)

    console.log('=== LINE WEBHOOK EVENT ===')
    console.log(JSON.stringify(data, null, 2))

    // Process each event
    for (const event of data.events || []) {
      const eventType = event.type
      const source = event.source
      const replyToken = event.replyToken

      console.log(`Event Type: ${eventType}`)
      console.log(`Source Type: ${source?.type}`)

      // Reply with Group ID when message received in group
      if (source?.type === 'group' && eventType === 'message') {
        const messageText = event.message?.text || ''

        // If user types "groupid" or "group id", reply with the group ID
        if (messageText.toLowerCase().includes('groupid') || messageText.toLowerCase().includes('group id')) {
          const groupId = source.groupId
          console.log(`GROUP ID: ${groupId}`)

          await replyMessage(replyToken,
            `🎉 Group ID ของกลุ่มนี้คือ:\n\n${groupId}\n\n📋 นำไปใส่ใน Vercel Environment Variables:\nLINE_NOTIFY_USER_ID = ${groupId}`
          )
        }
      }

      // Auto reply with Group ID when bot joins
      if (source?.type === 'group' && eventType === 'join') {
        const groupId = source.groupId
        console.log(`BOT JOINED GROUP: ${groupId}`)

        await replyMessage(replyToken,
          `👋 สวัสดี! Bot เข้ากลุ่มแล้ว\n\n🎉 Group ID:\n${groupId}\n\n📋 นำไปใส่ใน Vercel:\nLINE_NOTIFY_USER_ID = ${groupId}`
        )
      }

      // Log IDs
      if (source?.type === 'group') {
        console.log(`GROUP ID: ${source.groupId}`)
      } else if (source?.type === 'user') {
        console.log(`User ID: ${source.userId}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// LINE sends GET request to verify webhook URL
export async function GET() {
  return NextResponse.json({ status: 'LINE Webhook is active' })
}
