import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLineFlexMessage, createDailyReportFlex, DailyReportData } from '@/lib/line/client'

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
    // Use today's date (Thailand timezone)
    const now = new Date()
    // Adjust for Thailand timezone (UTC+7)
    const thailandOffset = 7 * 60 * 60 * 1000
    const thailandDate = new Date(now.getTime() + thailandOffset)
    const reportDate = thailandDate.toISOString().split('T')[0]

    console.log(`[Cron] Generating daily report for ${reportDate}`)

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

    // Get orders for the date
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
      .gte('created_at', `${reportDate}T00:00:00`)
      .lte('created_at', `${reportDate}T23:59:59`)

    // Get chat counts for the date
    const { data: chatCounts } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count')
      .eq('date', reportDate)

    // Calculate total income from deposits (same as Dashboard)
    const totalDepositsIncome = orders?.reduce((sum, o) => sum + (o.deposit || 0), 0) || 0

    // Calculate stats for each staff
    const salesReports = staff.map((s) => {
      const staffOrders = orders?.filter((o) => o.sales_id === s.id) || []
      const chatData = chatCounts?.find((c) => c.staff_id === s.id)
      const chatCount = chatData?.chat_count || 0

      const bookingOrders = staffOrders.filter((o) => o.order_status === 'booking')
      const paidOrders = staffOrders.filter((o) => o.order_status === 'paid')
      const doneOrders = staffOrders.filter((o) => o.order_status === 'done')

      const bookingAmount = bookingOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const paidAmount = paidOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const doneAmount = doneOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

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

    // Build report data
    const reportData: DailyReportData = {
      date: reportDate,
      salesReports,
      totalChats,
      totalOrders,
      totalClose,
      totalConversionRate,
      totalBookingAmount,
      totalPaidAmount,
      totalDoneAmount,
      totalRealIncome,
      servicesSold,
    }

    // Get the notification recipient
    const recipientId = process.env.LINE_NOTIFY_USER_ID

    if (!recipientId) {
      console.log('[Cron] LINE_NOTIFY_USER_ID not configured')
      return NextResponse.json({ success: false, error: 'LINE_NOTIFY_USER_ID not configured' })
    }

    // Create and send the flex message
    const flexContents = createDailyReportFlex(reportData)

    const dateObj = new Date(reportDate)
    const dateStr = dateObj.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    const result = await sendLineFlexMessage({
      to: recipientId,
      altText: `Daily Report ${dateStr} - รายได้ ฿${totalRealIncome.toLocaleString()}`,
      contents: flexContents,
    })

    if (!result.success) {
      console.log(`[Cron] Failed to send LINE message: ${result.error}`)
      return NextResponse.json({ success: false, error: result.error })
    }

    console.log(`[Cron] Daily report sent successfully for ${reportDate}`)
    return NextResponse.json({
      success: true,
      date: reportDate,
      totalOrders,
      totalRealIncome,
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
