import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLineNotify, formatDailyReportNotifyMessage, DailyReportData } from '@/lib/line/client'

// Create a simple Supabase client for API routes
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date } = body

    // Use provided date or today
    const reportDate = date || new Date().toISOString().split('T')[0]

    const supabase = getSupabaseClient()

    // Get all sales staff
    const { data: staff } = await supabase
      .from('staff')
      .select('id, staff_name')
      .in('role', ['sales', 'admin'])
      .eq('is_active', true)
      .order('staff_name')

    if (!staff || staff.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No staff found' },
        { status: 404 }
      )
    }

    // Get orders for the date
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        sales_id,
        order_status,
        total_income,
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

    // Get payments for the date (actual income received)
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, order_id')
      .gte('created_at', `${reportDate}T00:00:00`)
      .lte('created_at', `${reportDate}T23:59:59`)

    // Calculate total income from payments
    const totalPaymentsIncome = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

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
    // Use payments table for actual income received today
    const totalRealIncome = totalPaymentsIncome

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

    // Check LINE Notify token
    const notifyToken = process.env.LINE_NOTIFY_TOKEN

    if (!notifyToken) {
      return NextResponse.json(
        { success: false, error: 'LINE_NOTIFY_TOKEN not configured. Please add it to environment variables.', reportData },
        { status: 500 }
      )
    }

    // Format and send via LINE Notify (free unlimited)
    const message = formatDailyReportNotifyMessage(reportData)

    console.log('Sending Daily Report via LINE Notify...')
    const result = await sendLineNotify(message)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, reportData },
        { status: 500 }
      )
    }

    console.log('Daily Report sent successfully!')
    return NextResponse.json({ success: true, reportData })
  } catch (error) {
    console.error('Daily report error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
