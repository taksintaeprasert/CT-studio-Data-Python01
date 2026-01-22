import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendLineNotify,
  formatDailyReportNotifyMessage,
  sendLineFlexMessage,
  createSalesReportFlex,
  createDailyReportFlex,
  DailyReportData,
  SalesReportData
} from '@/lib/line/client'

// Create a simple Supabase client for API routes
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Vercel Cron Job handler
export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended for production)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development or if CRON_SECRET is not set
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Calculate date range: 26th of last month to today (or 25th if today >= 26)
    const now = new Date()
    const thailandOffset = 7 * 60 * 60 * 1000
    const thailandDate = new Date(now.getTime() + thailandOffset)

    const currentDay = thailandDate.getDate()
    const currentMonth = thailandDate.getMonth()
    const currentYear = thailandDate.getFullYear()

    let startDate: Date
    let endDate: Date

    if (currentDay >= 26) {
      // From 26th of current month to today
      startDate = new Date(currentYear, currentMonth, 26)
      endDate = thailandDate
    } else {
      // From 26th of last month to today
      startDate = new Date(currentYear, currentMonth - 1, 26)
      endDate = thailandDate
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    console.log(`[Cron] Generating report for ${startDateStr} to ${endDateStr}`)

    const supabase = getSupabaseClient()

    // Get all sales staff
    const { data: staff } = await supabase
      .from('staff')
      .select('id, staff_name')
      .in('role', ['sales', 'admin'])
      .eq('is_active', true)
      .order('staff_name')

    if (!staff || staff.length === 0) {
      console.log('[Cron] No staff found')
      return NextResponse.json({ success: false, error: 'No staff found' })
    }

    // Get orders for the date range
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        sales_id,
        order_status,
        total_income,
        deposit,
        order_items (
          product_id,
          products (
            product_name,
            category,
            list_price
          )
        )
      `)
      .gte('created_at', `${startDateStr}T00:00:00`)
      .lte('created_at', `${endDateStr}T23:59:59`)

    // Get chat counts for the date range (sum all days)
    const { data: chatCounts } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count, walk_in_count, google_review_count, follow_up_closed')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    // Sum daily metrics from all records in date range
    const walkInCount = chatCounts?.reduce((sum, c) => sum + (c.walk_in_count || 0), 0) || 0
    const googleReviewCount = chatCounts?.reduce((sum, c) => sum + (c.google_review_count || 0), 0) || 0
    const followUpClosed = chatCounts?.reduce((sum, c) => sum + (c.follow_up_closed || 0), 0) || 0

    // Calculate total income from deposits (same as Dashboard)
    const totalDepositsIncome = orders?.reduce((sum, o) => sum + (o.deposit || 0), 0) || 0

    // Calculate stats for each staff
    const salesReports = staff.map((s) => {
      const staffOrders = orders?.filter((o) => o.sales_id === s.id) || []

      // Sum chat counts from all days for this staff
      const staffChatRecords = chatCounts?.filter((c) => c.staff_id === s.id) || []
      const chatCount = staffChatRecords.reduce((sum, c) => sum + (c.chat_count || 0), 0)

      const bookingOrders = staffOrders.filter((o) => o.order_status === 'booking')
      const paidOrders = staffOrders.filter((o) => o.order_status === 'paid')
      const doneOrders = staffOrders.filter((o) => o.order_status === 'done')

      const bookingAmount = bookingOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const paidAmount = paidOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const doneAmount = doneOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

      // Real income = deposits from orders this staff sold
      const realIncome = staffOrders.reduce((sum, o) => sum + (o.deposit || 0), 0)

      const conversionRate = chatCount > 0 ? (staffOrders.length / chatCount) * 100 : 0

      return {
        staffName: s.staff_name,
        chatCount,
        orderCount: staffOrders.length,
        closeCount: doneOrders.length,
        conversionRate,
        bookingAmount,
        paidAmount,
        doneAmount,
        realIncome,
      }
    })

    // Calculate totals
    const totalChats = salesReports.reduce((sum, s) => sum + s.chatCount, 0)
    const totalOrders = salesReports.reduce((sum, s) => sum + s.orderCount, 0)
    const totalClose = salesReports.reduce((sum, s) => sum + s.closeCount, 0)
    const totalConversionRate = totalChats > 0 ? (totalOrders / totalChats) * 100 : 0
    const totalBookingAmount = salesReports.reduce((sum, s) => sum + s.bookingAmount, 0)
    const totalPaidAmount = salesReports.reduce((sum, s) => sum + s.paidAmount, 0)
    const totalDoneAmount = salesReports.reduce((sum, s) => sum + s.doneAmount, 0)
    // Use deposits from orders created today (same as Dashboard)
    const totalRealIncome = totalDepositsIncome

    // Calculate services sold by category
    const serviceMap = new Map<string, { count: number; amount: number }>()

    orders?.forEach((order) => {
      order.order_items?.forEach((item: { products: { category: string | null; list_price: number } | null }) => {
        if (item.products) {
          const category = item.products.category || 'Other'
          const existing = serviceMap.get(category) || { count: 0, amount: 0 }
          serviceMap.set(category, {
            count: existing.count + 1,
            amount: existing.amount + (item.products.list_price || 0),
          })
        }
      })
    })

    const servicesSold = Array.from(serviceMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        amount: data.amount,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Calculate master bookings (services priced at 20,000+)
    let masterBookingAmount = 0
    orders?.forEach((order) => {
      order.order_items?.forEach((item: { products: { list_price: number } | null }) => {
        if (item.products && item.products.list_price >= 20000) {
          masterBookingAmount += item.products.list_price
        }
      })
    })

    // Calculate 50% customers (orders containing "50%" in product name)
    const halfPriceCustomers = orders?.filter((order) => {
      return order.order_items?.some((item: { products: { product_name: string } | null }) => {
        const productName = item.products?.product_name || ''
        return productName.toUpperCase().includes('50%')
      })
    }).length || 0

    // Build overall report data
    const reportData: DailyReportData = {
      startDate: startDateStr,
      endDate: endDateStr,
      salesReports,
      totalChats,
      totalOrders,
      totalClose,
      totalConversionRate,
      totalBookingAmount,
      totalPaidAmount,
      totalDoneAmount,
      totalRealIncome,
      // New fields
      walkInCount,
      googleReviewCount,
      followUpClosed,
      masterBookingAmount,
      halfPriceCustomers,
      servicesSold,
    }

    // Build individual sales reports
    const individualReports: SalesReportData[] = staff.map((s) => {
      const staffOrders = orders?.filter((o) => o.sales_id === s.id) || []
      const staffChatRecords = chatCounts?.filter((c) => c.staff_id === s.id) || []
      const chatCount = staffChatRecords.reduce((sum, c) => sum + (c.chat_count || 0), 0)

      const bookingAmount = staffOrders
        .filter((o) => o.order_status === 'booking')
        .reduce((sum, o) => sum + (o.total_income || 0), 0)

      const realIncome = staffOrders.reduce((sum, o) => sum + (o.deposit || 0), 0)
      const conversionRate = chatCount > 0 ? (staffOrders.length / chatCount) * 100 : 0

      // Calculate services sold by this staff
      const staffServiceMap = new Map<string, { count: number; amount: number }>()
      staffOrders.forEach((order) => {
        order.order_items?.forEach((item: { products: { category: string | null; list_price: number } | null }) => {
          if (item.products) {
            const category = item.products.category || 'Other'
            const existing = staffServiceMap.get(category) || { count: 0, amount: 0 }
            staffServiceMap.set(category, {
              count: existing.count + 1,
              amount: existing.amount + (item.products.list_price || 0),
            })
          }
        })
      })

      const servicesSold = Array.from(staffServiceMap.entries())
        .map(([category, data]) => ({
          category,
          count: data.count,
          amount: data.amount,
        }))
        .sort((a, b) => b.amount - a.amount)

      return {
        staffName: s.staff_name,
        startDate: startDateStr,
        endDate: endDateStr,
        chatCount,
        orderCount: staffOrders.length,
        conversionRate,
        bookingAmount,
        realIncome,
        servicesSold,
      }
    })

    // Check LINE Messaging API token
    const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const userId = process.env.LINE_NOTIFY_USER_ID

    if (!channelToken || !userId) {
      console.log('[Cron] LINE_CHANNEL_ACCESS_TOKEN or LINE_NOTIFY_USER_ID not configured')
      return NextResponse.json({ success: false, error: 'LINE credentials not configured' })
    }

    console.log(`[Cron] Sending reports via LINE Messaging API...`)

    // 1. Send individual reports for each sales staff
    let individualSuccess = 0
    let individualFailed = 0

    for (const report of individualReports) {
      const flexMessage = createSalesReportFlex(report)
      const result = await sendLineFlexMessage({
        to: userId,
        altText: `📊 ${report.staffName} - Report`,
        contents: flexMessage,
      })

      if (result.success) {
        individualSuccess++
        console.log(`[Cron] Individual report sent for ${report.staffName}`)
      } else {
        individualFailed++
        console.error(`[Cron] Failed to send report for ${report.staffName}: ${result.error}`)
      }

      // Add small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 2. Send overall summary report
    const summaryFlexMessage = createDailyReportFlex(reportData)
    const summaryResult = await sendLineFlexMessage({
      to: userId,
      altText: '📊 Summary Report',
      contents: summaryFlexMessage,
    })

    if (!summaryResult.success) {
      console.error(`[Cron] Failed to send summary report: ${summaryResult.error}`)
    } else {
      console.log(`[Cron] Summary report sent successfully`)
    }

    console.log(`[Cron] Reports sent: ${individualSuccess}/${individualReports.length} individual, summary: ${summaryResult.success ? 'OK' : 'FAILED'}`)

    return NextResponse.json({
      success: true,
      dateRange: `${startDateStr} to ${endDateStr}`,
      totalOrders,
      totalRealIncome,
      individualReportsSent: individualSuccess,
      summaryReportSent: summaryResult.success,
    })
  } catch (error) {
    console.error('[Cron] Daily report error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Also support POST for external cron services like cron-job.org
export async function POST(request: NextRequest) {
  return GET(request)
}
