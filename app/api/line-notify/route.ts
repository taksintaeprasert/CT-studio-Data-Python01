import { NextRequest, NextResponse } from 'next/server'
import { sendLineNotify, formatOrderNotifyMessage } from '@/lib/line/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    console.log('=== LINE NOTIFY DEBUG ===')
    console.log('Request type:', type)
    console.log('Using LINE Messaging API')

    // Check LINE Messaging API credentials
    const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const userId = process.env.LINE_NOTIFY_USER_ID
    console.log('LINE_CHANNEL_ACCESS_TOKEN:', channelToken ? 'SET' : 'NOT SET')
    console.log('LINE_NOTIFY_USER_ID:', userId ? 'SET' : 'NOT SET')

    if (!channelToken || !userId) {
      console.error('LINE credentials not configured')
      return NextResponse.json(
        { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN or LINE_NOTIFY_USER_ID not configured.' },
        { status: 500 }
      )
    }

    if (type === 'new_order') {
      const { orderId, customerName, salesName, products, totalAmount, deposit, status } = data

      // Format message for LINE Notify
      const message = formatOrderNotifyMessage({
        orderId,
        customerName,
        salesName,
        products,
        totalAmount,
        deposit,
        status,
      })

      console.log('Sending via LINE Notify...')
      const result = await sendLineNotify(message)

      console.log('LINE Notify Result:', JSON.stringify(result))

      if (!result.success) {
        console.error('LINE Notify Failed:', result.error)
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      console.log('LINE Notify Sent Successfully!')
      return NextResponse.json({ success: true })
    }

    if (type === 'text') {
      const { message } = data

      const result = await sendLineNotify(message)

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid notification type' },
      { status: 400 }
    )
  } catch (error) {
    console.error('LINE notify error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
