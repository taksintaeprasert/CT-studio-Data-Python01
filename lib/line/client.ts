// LINE Messaging API Client

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push'

interface LineMessagePayload {
  to: string
  messages: LineMessage[]
}

interface LineMessage {
  type: 'text' | 'flex'
  text?: string
  altText?: string
  contents?: object
}

interface SendLineMessageOptions {
  to: string
  message: string
  accessToken?: string
}

interface SendLineFlexMessageOptions {
  to: string
  altText: string
  contents: object
  accessToken?: string
}

export async function sendLineTextMessage({
  to,
  message,
  accessToken,
}: SendLineMessageOptions): Promise<{ success: boolean; error?: string }> {
  const token = accessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN

  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
    return { success: false, error: 'LINE access token not configured' }
  }

  if (!to) {
    console.error('LINE recipient (to) is not specified')
    return { success: false, error: 'Recipient not specified' }
  }

  try {
    const payload: LineMessagePayload = {
      to,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    }

    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('LINE API Error:', errorData)
      return { success: false, error: errorData.message || 'Failed to send message' }
    }

    return { success: true }
  } catch (error) {
    console.error('LINE send message error:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function sendLineFlexMessage({
  to,
  altText,
  contents,
  accessToken,
}: SendLineFlexMessageOptions): Promise<{ success: boolean; error?: string }> {
  const token = accessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN

  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
    return { success: false, error: 'LINE access token not configured' }
  }

  if (!to) {
    console.error('LINE recipient (to) is not specified')
    return { success: false, error: 'Recipient not specified' }
  }

  try {
    const payload: LineMessagePayload = {
      to,
      messages: [
        {
          type: 'flex',
          altText,
          contents,
        },
      ],
    }

    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('LINE API Error:', errorData)
      return { success: false, error: errorData.message || 'Failed to send message' }
    }

    return { success: true }
  } catch (error) {
    console.error('LINE send message error:', error)
    return { success: false, error: 'Network error' }
  }
}

// Create a Flex Message for new order notification
export function createOrderNotificationFlex(order: {
  orderId: number
  customerName: string
  salesName: string
  products: string[]
  totalAmount: number
  deposit: number
  status: string
}): object {
  const statusColors: Record<string, string> = {
    booking: '#F59E0B',
    paid: '#10B981',
    done: '#3B82F6',
    cancelled: '#EF4444',
  }

  const statusLabels: Record<string, string> = {
    booking: 'Booking',
    paid: 'Paid',
    done: 'Completed',
    cancelled: 'Cancelled',
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'NEW ORDER',
              color: '#ffffff',
              size: 'sm',
              weight: 'bold',
            },
            {
              type: 'text',
              text: `#${order.orderId}`,
              color: '#ffffff',
              size: 'sm',
              align: 'end',
            },
          ],
        },
      ],
      backgroundColor: '#EC4899',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'Customer',
              color: '#8c8c8c',
              size: 'sm',
              flex: 2,
            },
            {
              type: 'text',
              text: order.customerName,
              wrap: true,
              weight: 'bold',
              size: 'sm',
              flex: 4,
            },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'Sales',
              color: '#8c8c8c',
              size: 'sm',
              flex: 2,
            },
            {
              type: 'text',
              text: order.salesName,
              wrap: true,
              size: 'sm',
              flex: 4,
            },
          ],
          margin: 'md',
        },
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'text',
          text: 'Products',
          color: '#8c8c8c',
          size: 'sm',
          margin: 'lg',
        },
        ...order.products.map((product) => ({
          type: 'text',
          text: `• ${product}`,
          size: 'sm',
          margin: 'sm',
          wrap: true,
        })),
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'Total',
              color: '#8c8c8c',
              size: 'sm',
              flex: 2,
            },
            {
              type: 'text',
              text: `฿${order.totalAmount.toLocaleString()}`,
              weight: 'bold',
              size: 'lg',
              color: '#EC4899',
              flex: 4,
              align: 'end',
            },
          ],
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'Deposit',
              color: '#8c8c8c',
              size: 'sm',
              flex: 2,
            },
            {
              type: 'text',
              text: `฿${order.deposit.toLocaleString()}`,
              size: 'sm',
              flex: 4,
              align: 'end',
            },
          ],
          margin: 'sm',
        },
      ],
      paddingAll: 'lg',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: 'Status:',
              size: 'sm',
              color: '#8c8c8c',
            },
            {
              type: 'text',
              text: statusLabels[order.status] || order.status,
              size: 'sm',
              weight: 'bold',
              color: statusColors[order.status] || '#8c8c8c',
              align: 'end',
            },
          ],
        },
      ],
      paddingAll: 'lg',
      backgroundColor: '#f7f7f7',
    },
  }
}
