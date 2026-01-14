import { NextRequest, NextResponse } from 'next/server'
import { sendLineTextMessage, sendLineFlexMessage, createOrderNotificationFlex } from '@/lib/line/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    console.log('=== LINE NOTIFY DEBUG ===')
    console.log('Request type:', type)
    console.log('Request data:', JSON.stringify(data, null, 2))

    // Get the notification recipient from environment
    const recipientId = process.env.LINE_NOTIFY_USER_ID
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

    console.log('LINE_NOTIFY_USER_ID:', recipientId ? `${recipientId.substring(0, 10)}...` : 'NOT SET')
    console.log('LINE_CHANNEL_ACCESS_TOKEN:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT SET')

    if (!recipientId) {
      console.error('LINE_NOTIFY_USER_ID is not configured')
      return NextResponse.json(
        { success: false, error: 'Notification recipient not configured' },
        { status: 500 }
      )
    }

    if (!accessToken) {
      console.error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
      return NextResponse.json(
        { success: false, error: 'LINE access token not configured' },
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

      console.log('Sending LINE Flex Message...')
      const result = await sendLineFlexMessage({
        to: recipientId,
        altText: `New Order #${orderId} - ${customerName} - ฿${totalAmount.toLocaleString()}`,
        contents: flexContents,
      })

      console.log('LINE Flex Message Result:', JSON.stringify(result))

      if (!result.success) {
        console.error('LINE Flex Message Failed:', result.error)
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      console.log('LINE Flex Message Sent Successfully!')
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
