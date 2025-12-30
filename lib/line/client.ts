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

// Daily Report Data Interface
export interface DailyReportData {
  date: string
  salesReports: {
    staffName: string
    chatCount: number
    orderCount: number
    closeCount: number
    conversionRate: number
    bookingAmount: number
    paidAmount: number
    doneAmount: number
  }[]
  totalChats: number
  totalOrders: number
  totalClose: number
  totalConversionRate: number
  totalBookingAmount: number
  totalPaidAmount: number
  totalDoneAmount: number
  totalRealIncome: number
  servicesSold: {
    category: string
    count: number
    amount: number
  }[]
}

// Create Daily Report Flex Message
export function createDailyReportFlex(report: DailyReportData): object {
  // Format date in Thai
  const dateObj = new Date(report.date)
  const dateStr = dateObj.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Build sales rows
  const salesRows = report.salesReports.map((s) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: s.staffName, size: 'xs', flex: 2, color: '#555555' },
      { type: 'text', text: String(s.chatCount), size: 'xs', flex: 1, align: 'center' },
      { type: 'text', text: String(s.orderCount), size: 'xs', flex: 1, align: 'center' },
      { type: 'text', text: `${s.conversionRate.toFixed(0)}%`, size: 'xs', flex: 1, align: 'center', color: s.conversionRate > 0 ? '#10B981' : '#8c8c8c' },
      { type: 'text', text: `฿${(s.bookingAmount / 1000).toFixed(0)}k`, size: 'xs', flex: 2, align: 'end' },
    ],
    margin: 'sm',
  }))

  // Build services rows
  const serviceRows = report.servicesSold
    .filter(s => s.count > 0)
    .map((s) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: s.category, size: 'xs', flex: 3, color: '#555555' },
        { type: 'text', text: `${s.count} คน`, size: 'xs', flex: 2, align: 'center' },
        { type: 'text', text: `฿${s.amount.toLocaleString()}`, size: 'xs', flex: 2, align: 'end', color: '#EC4899' },
      ],
      margin: 'sm',
    }))

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '📊 DAILY REPORT',
          color: '#ffffff',
          size: 'lg',
          weight: 'bold',
        },
        {
          type: 'text',
          text: dateStr,
          color: '#ffffff',
          size: 'xs',
          margin: 'sm',
        },
      ],
      backgroundColor: '#EC4899',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Summary Section
        {
          type: 'text',
          text: '📈 สรุปภาพรวม',
          weight: 'bold',
          size: 'sm',
          color: '#1f2937',
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'New Chat', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: String(report.totalChats), size: 'lg', weight: 'bold', align: 'center', color: '#3B82F6' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'Orders', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: String(report.totalOrders), size: 'lg', weight: 'bold', align: 'center', color: '#F59E0B' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'Close', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: String(report.totalClose), size: 'lg', weight: 'bold', align: 'center', color: '#10B981' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'CR%', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `${report.totalConversionRate.toFixed(0)}%`, size: 'lg', weight: 'bold', align: 'center', color: '#8B5CF6' },
              ],
              flex: 1,
            },
          ],
          margin: 'md',
          paddingAll: 'sm',
          backgroundColor: '#f9fafb',
          cornerRadius: 'md',
        },

        // Income Summary
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'Booking', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `฿${report.totalBookingAmount.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'center', color: '#F59E0B' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'Paid', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `฿${report.totalPaidAmount.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'center', color: '#10B981' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'Done', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `฿${report.totalDoneAmount.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'center', color: '#3B82F6' },
              ],
              flex: 1,
            },
          ],
          margin: 'md',
          paddingAll: 'sm',
          backgroundColor: '#f9fafb',
          cornerRadius: 'md',
        },

        // Real Income
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '💰 รายได้จริงวันนี้', size: 'sm', weight: 'bold', flex: 3 },
            { type: 'text', text: `฿${report.totalRealIncome.toLocaleString()}`, size: 'lg', weight: 'bold', color: '#EC4899', align: 'end', flex: 3 },
          ],
          margin: 'lg',
          paddingAll: 'md',
          backgroundColor: '#fdf2f8',
          cornerRadius: 'md',
        },

        { type: 'separator', margin: 'lg' },

        // Sales Performance
        {
          type: 'text',
          text: '👥 ผลงาน Sales',
          weight: 'bold',
          size: 'sm',
          color: '#1f2937',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'Name', size: 'xxs', flex: 2, color: '#8c8c8c' },
            { type: 'text', text: 'Chat', size: 'xxs', flex: 1, align: 'center', color: '#8c8c8c' },
            { type: 'text', text: 'Order', size: 'xxs', flex: 1, align: 'center', color: '#8c8c8c' },
            { type: 'text', text: 'CR%', size: 'xxs', flex: 1, align: 'center', color: '#8c8c8c' },
            { type: 'text', text: 'Booking', size: 'xxs', flex: 2, align: 'end', color: '#8c8c8c' },
          ],
          margin: 'md',
        },
        ...salesRows,

        { type: 'separator', margin: 'lg' },

        // Services Sold
        {
          type: 'text',
          text: '💅 บริการที่ขายได้',
          weight: 'bold',
          size: 'sm',
          color: '#1f2937',
          margin: 'lg',
        },
        ...(serviceRows.length > 0 ? serviceRows : [
          { type: 'text', text: 'ไม่มีข้อมูล', size: 'xs', color: '#8c8c8c', margin: 'sm' },
        ]),
      ],
      paddingAll: 'lg',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'CT Studio ERP System',
          size: 'xxs',
          color: '#8c8c8c',
          align: 'center',
        },
      ],
      paddingAll: 'md',
      backgroundColor: '#f7f7f7',
    },
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
