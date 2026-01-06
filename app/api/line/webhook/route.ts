import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

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

      console.log(`Event Type: ${eventType}`)
      console.log(`Source Type: ${source?.type}`)

      // Log IDs based on source type
      if (source?.type === 'group') {
        console.log('========================================')
        console.log('🎉 GROUP ID FOUND!')
        console.log(`GROUP ID: ${source.groupId}`)
        console.log('========================================')
        console.log('ใช้ Group ID นี้ใน LINE_NOTIFY_USER_ID เพื่อส่ง Report ไปกลุ่ม')
      } else if (source?.type === 'room') {
        console.log('========================================')
        console.log('🎉 ROOM ID FOUND!')
        console.log(`ROOM ID: ${source.roomId}`)
        console.log('========================================')
      } else if (source?.type === 'user') {
        console.log(`User ID: ${source.userId}`)
      }

      // Handle specific events
      if (eventType === 'join') {
        console.log('✅ BOT joined a group/room!')
      } else if (eventType === 'message') {
        console.log(`Message: ${event.message?.text || '(non-text)'}`)
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
