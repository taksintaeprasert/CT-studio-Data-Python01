// LINE Messaging API Client

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push'

// Send message via LINE Messaging API (using Channel Access Token)
export async function sendLineNotify(message: string): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const userId = process.env.LINE_NOTIFY_USER_ID

  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
    return { success: false, error: 'LINE Channel Access Token not configured' }
  }

  if (!userId) {
    console.error('LINE_NOTIFY_USER_ID is not configured')
    return { success: false, error: 'LINE User ID not configured' }
  }

  try {
    console.log('=== sendLineNotify DEBUG ===')
    console.log('Sending via LINE Messaging API...')

    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    })

    console.log('LINE Messaging API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE Messaging API Error:', errorText)
      return { success: false, error: `LINE Messaging API failed (${response.status}): ${errorText}` }
    }

    console.log('LINE message sent successfully!')
    return { success: true }
  } catch (error) {
    console.error('LINE Messaging API error:', error)
    return { success: false, error: 'Network error: ' + (error instanceof Error ? error.message : String(error)) }
  }
}

// Format order notification for LINE Notify (text-based)
export function formatOrderNotifyMessage(order: {
  orderId: number
  customerName: string
  salesName: string
  products: string[]
  totalAmount: number
  deposit: number
  status: string
}): string {
  const productList = order.products.map(p => `  • ${p}`).join('\n')

  return `
🛒 NEW ORDER #${order.orderId}

👤 ลูกค้า: ${order.customerName}
👩‍💼 Sales: ${order.salesName}

📦 บริการ:
${productList}

💰 ยอดรวม: ฿${order.totalAmount.toLocaleString()}
💵 มัดจำ: ฿${order.deposit.toLocaleString()}
📋 สถานะ: ${order.status === 'booking' ? 'Booking' : order.status}
`
}

// Format daily report for LINE Notify
export function formatDailyReportNotifyMessage(report: DailyReportData): string {
  const dateObj = new Date(report.date)
  const dateStr = dateObj.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Sales performance per person
  const salesLines = report.salesReports.map(s =>
    `👤 ${s.staffName}
   New chats: ${s.chatCount}
   Deals closed: ${s.orderCount}
   CR%: ${s.conversionRate.toFixed(0)}%`
  ).join('\n\n')

  // Services sold
  const serviceLines = report.servicesSold
    .filter(s => s.count > 0)
    .map(s => `  • ${s.category}: ${s.count} pax (฿${s.amount.toLocaleString()})`)
    .join('\n')

  return `📊 DAILY REPORT
${dateStr}

━━━━━━━━━━━━━━━━━━
📈 Daily Performance
━━━━━━━━━━━━━━━━━━
New chats: ${report.totalChats}
Deals closed: ${report.totalOrders}
CR%: ${report.totalConversionRate.toFixed(0)}%

🚶 Walk-in customers: ${report.walkInCount || 0}
⭐️ Google reviews: ${report.googleReviewCount || 0}

━━━━━━━━━━━━━━━━━━
💰 Revenue
━━━━━━━━━━━━━━━━━━
Bookings today: ฿${report.totalBookingAmount.toLocaleString()}
Master bookings (20k+): ฿${(report.masterBookingAmount || 0).toLocaleString()}
50% customers: ${report.halfPriceCustomers || 0}
Closed from follow-up: ${report.followUpClosed || 0}

💵 Actual revenue: ฿${report.totalRealIncome.toLocaleString()}

━━━━━━━━━━━━━━━━━━
👥 Sales Performance
━━━━━━━━━━━━━━━━━━
${salesLines || 'ไม่มีข้อมูล'}

━━━━━━━━━━━━━━━━━━
💅 Services Sold
━━━━━━━━━━━━━━━━━━
${serviceLines || 'ไม่มีข้อมูล'}`
}

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

  console.log('=== sendLineFlexMessage DEBUG ===')
  console.log('to:', to)
  console.log('altText:', altText)
  console.log('token exists:', !!token)

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

    console.log('Calling LINE API:', LINE_API_URL)
    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    console.log('LINE API Response Status:', response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('LINE API Error Response:', JSON.stringify(errorData))
      return { success: false, error: errorData.message || `Failed to send message (${response.status})` }
    }

    console.log('LINE API call successful')
    return { success: true }
  } catch (error) {
    console.error('LINE send message error:', error)
    return { success: false, error: 'Network error: ' + (error instanceof Error ? error.message : String(error)) }
  }
}

// Daily Report Data Interface
export interface DailyReportData {
  startDate: string  // วันที่เริ่มต้น (26)
  endDate: string    // วันที่สิ้นสุด (25 หรือวันปัจจุบัน)
  salesReports: {
    staffName: string
    chatCount: number
    orderCount: number
    closeCount: number
    conversionRate: number
    bookingAmount: number
    paidAmount: number
    doneAmount: number
    realIncome: number
  }[]
  totalChats: number
  totalOrders: number
  totalClose: number
  totalConversionRate: number
  totalBookingAmount: number
  totalPaidAmount: number
  totalDoneAmount: number
  totalRealIncome: number
  // New fields
  walkInCount: number
  googleReviewCount: number
  followUpClosed: number
  masterBookingAmount: number  // Services 20,000+
  halfPriceCustomers: number   // Orders containing "50%"
  servicesSold: {
    category: string
    count: number
    amount: number
  }[]
}

// Individual Sales Report Data
export interface SalesReportData {
  staffName: string
  startDate: string
  endDate: string
  chatCount: number
  orderCount: number
  conversionRate: number
  bookingAmount: number
  realIncome: number
  servicesSold: {
    category: string
    count: number
    amount: number
  }[]
}

// Create Individual Sales Report Flex Message
export function createSalesReportFlex(report: SalesReportData): object {
  // Format date range
  const startDateObj = new Date(report.startDate)
  const endDateObj = new Date(report.endDate)
  const dateRange = `${startDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${endDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // Build services rows
  const serviceRows = report.servicesSold
    .filter(s => s.count > 0)
    .map((s) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: s.category, size: 'xs', flex: 3, color: '#555555' },
        { type: 'text', text: `${s.count} pax`, size: 'xs', flex: 2, align: 'center' },
        { type: 'text', text: `฿${s.amount.toLocaleString()}`, size: 'xs', flex: 2, align: 'end', color: '#EC4899' },
      ],
      margin: 'sm',
    }))

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `📊 ${report.staffName}`,
          color: '#ffffff',
          size: 'lg',
          weight: 'bold',
        },
        {
          type: 'text',
          text: dateRange,
          color: '#ffffff',
          size: 'xs',
          margin: 'sm',
        },
      ],
      backgroundColor: '#8B5CF6',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Performance Summary
        {
          type: 'text',
          text: '📈 Performance',
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
                { type: 'text', text: 'Chat', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: String(report.chatCount), size: 'lg', weight: 'bold', align: 'center', color: '#3B82F6' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'Order', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: String(report.orderCount), size: 'lg', weight: 'bold', align: 'center', color: '#F59E0B' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'CR%', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `${report.conversionRate.toFixed(0)}%`, size: 'lg', weight: 'bold', align: 'center', color: report.conversionRate > 0 ? '#10B981' : '#8c8c8c' },
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
                { type: 'text', text: `฿${report.bookingAmount.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'center', color: '#F59E0B' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: 'Income', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `฿${report.realIncome.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'center', color: '#10B981' },
              ],
              flex: 1,
            },
          ],
          margin: 'md',
          paddingAll: 'sm',
          backgroundColor: '#f9fafb',
          cornerRadius: 'md',
        },

        { type: 'separator', margin: 'lg' },

        // Services Sold
        {
          type: 'text',
          text: '💅 Services Sold',
          weight: 'bold',
          size: 'sm',
          color: '#1f2937',
          margin: 'lg',
        },
        ...(serviceRows.length > 0 ? serviceRows : [
          { type: 'text', text: 'No data', size: 'xs', color: '#8c8c8c', margin: 'sm' },
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
          text: 'CT Studio - Individual Report',
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

// Create Single Day Summary Flex Message (for today only)
export function createTodaySummaryFlex(report: DailyReportData): object {
  const dateObj = new Date(report.startDate)
  const dateDisplay = dateObj.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
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
        { type: 'text', text: `${s.count} pax`, size: 'xs', flex: 2, align: 'center' },
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
          text: '📊 TODAY SUMMARY',
          color: '#ffffff',
          size: 'lg',
          weight: 'bold',
        },
        {
          type: 'text',
          text: dateDisplay,
          color: '#ffffff',
          size: 'xs',
          margin: 'sm',
        },
      ],
      backgroundColor: '#10B981',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Summary Section
        {
          type: 'text',
          text: '📈 Summary',
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
                { type: 'text', text: 'Income', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `฿${report.totalRealIncome.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'center', color: '#10B981' },
              ],
              flex: 1,
            },
          ],
          margin: 'md',
          paddingAll: 'sm',
          backgroundColor: '#f9fafb',
          cornerRadius: 'md',
        },

        { type: 'separator', margin: 'lg' },

        // Sales Performance
        {
          type: 'text',
          text: '👥 Sales Performance',
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
          text: '💅 Services Sold',
          weight: 'bold',
          size: 'sm',
          color: '#1f2937',
          margin: 'lg',
        },
        ...(serviceRows.length > 0 ? serviceRows : [
          { type: 'text', text: 'No data', size: 'xs', color: '#8c8c8c', margin: 'sm' },
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
          text: 'CT Studio - Today Report',
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

// Create Daily Report Flex Message (Overall Summary)
export function createDailyReportFlex(report: DailyReportData): object {
  // Format date range
  const startDateObj = new Date(report.startDate)
  const endDateObj = new Date(report.endDate)
  const dateRange = `${startDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${endDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`

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
        { type: 'text', text: `${s.count} pax`, size: 'xs', flex: 2, align: 'center' },
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
          text: '📊 SUMMARY REPORT',
          color: '#ffffff',
          size: 'lg',
          weight: 'bold',
        },
        {
          type: 'text',
          text: dateRange,
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
          text: '📈 Summary',
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
                { type: 'text', text: 'Income', size: 'xxs', color: '#8c8c8c', align: 'center' },
                { type: 'text', text: `฿${report.totalRealIncome.toLocaleString()}`, size: 'sm', weight: 'bold', align: 'center', color: '#10B981' },
              ],
              flex: 1,
            },
          ],
          margin: 'md',
          paddingAll: 'sm',
          backgroundColor: '#f9fafb',
          cornerRadius: 'md',
        },

        { type: 'separator', margin: 'lg' },

        // Sales Performance
        {
          type: 'text',
          text: '👥 Sales Performance',
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
          text: '💅 Services Sold',
          weight: 'bold',
          size: 'sm',
          color: '#1f2937',
          margin: 'lg',
        },
        ...(serviceRows.length > 0 ? serviceRows : [
          { type: 'text', text: 'No data', size: 'xs', color: '#8c8c8c', margin: 'sm' },
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
