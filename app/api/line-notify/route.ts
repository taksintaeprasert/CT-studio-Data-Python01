import { NextRequest, NextResponse } from 'next/server'
import { sendLineNotify, formatOrderNotifyMessage, sendLineFlexMessage, createOrderNotificationFlex } from '@/lib/line/client'

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

      // Create Flex Message for new order
      const flexMessage = createOrderNotificationFlex({
        orderId,
        customerName,
        salesName,
        products,
        totalAmount,
        deposit,
        status,
      })

      console.log('Sending via LINE Messaging API (Flex Message)...')
      const result = await sendLineFlexMessage({
        to: userId!,
        altText: `NEW ORDER #${orderId}`,
        contents: flexMessage,
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
