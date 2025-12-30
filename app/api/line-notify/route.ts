import { NextRequest, NextResponse } from 'next/server'
import { sendLineTextMessage, sendLineFlexMessage, createOrderNotificationFlex } from '@/lib/line/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    // Get the notification recipient from environment
    const recipientId = process.env.LINE_NOTIFY_USER_ID

    if (!recipientId) {
      console.error('LINE_NOTIFY_USER_ID is not configured')
      return NextResponse.json(
        { success: false, error: 'Notification recipient not configured' },
        { status: 500 }
      )
    }

    if (type === 'new_order') {
      const { orderId, customerName, salesName, products, totalAmount, deposit, status } = data

      // Send flex message for new order
      const flexContents = createOrderNotificationFlex({
        orderId,
        customerName,
        salesName,
        products,
        totalAmount,
        deposit,
        status,
      })

      const result = await sendLineFlexMessage({
        to: recipientId,
        altText: `New Order #${orderId} - ${customerName} - ฿${totalAmount.toLocaleString()}`,
        contents: flexContents,
      })

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    if (type === 'text') {
      const { message } = data

      const result = await sendLineTextMessage({
        to: recipientId,
        message,
      })

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
