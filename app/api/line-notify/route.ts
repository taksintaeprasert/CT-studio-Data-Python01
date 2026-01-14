import { NextRequest, NextResponse } from 'next/server'
import { sendLineNotify, formatOrderNotifyMessage } from '@/lib/line/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    console.log('=== LINE NOTIFY DEBUG ===')
    console.log('Request type:', type)
    console.log('Using LINE Notify (free unlimited)')

    // Check LINE Notify token
    const notifyToken = process.env.LINE_NOTIFY_TOKEN
    console.log('LINE_NOTIFY_TOKEN:', notifyToken ? 'SET' : 'NOT SET')

    if (!notifyToken) {
      console.error('LINE_NOTIFY_TOKEN is not configured')
      return NextResponse.json(
        { success: false, error: 'LINE Notify token not configured. Please add LINE_NOTIFY_TOKEN to environment variables.' },
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
