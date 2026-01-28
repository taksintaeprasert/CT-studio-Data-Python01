import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendLineFlexMessage,
  createDailyReportFlex,
  createTodaySummaryFlex,
  DailyReportData
} from '@/lib/line/client'

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
    const endDateStr = date || new Date().toISOString().split('T')[0]

    // Calculate start date (26th of previous month or current month)
    const endDate = new Date(endDateStr)
    const day = endDate.getDate()
    let startDate: Date

    if (day >= 26) {
      // If date is >= 26, period starts on 26th of current month
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 26)
    } else {
      // If date is < 26, period starts on 26th of previous month
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 26)
    }

    const startDateStr = startDate.toISOString().split('T')[0]

    console.log(`[Daily Report] Generating report for period: ${startDateStr} to ${endDateStr}`)

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

    // ==================== PERIOD REPORT (26 - selected date) ====================

    // Get orders for the period
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
            product_code,
            category,
            list_price,
            is_free,
            validity_months
          )
        )
      `)
      .gte('created_at', `${startDateStr}T00:00:00`)
      .lte('created_at', `${endDateStr}T23:59:59`)

    // Get all orders for mapping payments to staff
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, sales_id')

    // Get payments made during the period (by payment_date)
    const { data: payments } = await supabase
      .from('payments')
      .select('order_id, amount, payment_date')
      .gte('payment_date', startDateStr)
      .lte('payment_date', endDateStr)

    // Get chat counts for the period
    const { data: chatCounts } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count, walk_in_count, google_review_count, follow_up_closed')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    // Calculate period metrics
    const walkInCount = chatCounts?.reduce((sum, c) => sum + (c.walk_in_count || 0), 0) || 0
    const googleReviewCount = chatCounts?.reduce((sum, c) => sum + (c.google_review_count || 0), 0) || 0
    const followUpClosed = chatCounts?.reduce((sum, c) => sum + (c.follow_up_closed || 0), 0) || 0
    const totalPaymentsIncome = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

    // Calculate stats for each staff (period)
    const salesReports = staff.map((s) => {
      const staffOrders = orders?.filter((o) => o.sales_id === s.id) || []
      const staffOrderIds = staffOrders.map(o => o.id)
      const staffChatCounts = chatCounts?.filter((c) => c.staff_id === s.id) || []
      const chatCount = staffChatCounts.reduce((sum, c) => sum + (c.chat_count || 0), 0)

      const bookingOrders = staffOrders.filter((o) => o.order_status === 'booking')
      const paidOrders = staffOrders.filter((o) => o.order_status === 'paid')
      const doneOrders = staffOrders.filter((o) => o.order_status === 'done')

      const bookingAmount = staffOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const paidAmount = paidOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const doneAmount = doneOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

      // Real income from payments (by payment_date) - use ALL orders for attribution
      const allStaffOrderIds = allOrders?.filter(o => o.sales_id === s.id).map(o => o.id) || []
      const staffPayments = payments?.filter(p => allStaffOrderIds.includes(p.order_id)) || []
      const realIncome = staffPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

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

    // Calculate period totals
    const totalChats = salesReports.reduce((sum, s) => sum + s.chatCount, 0)
    const totalOrders = salesReports.reduce((sum, s) => sum + s.orderCount, 0)
    const totalClose = salesReports.reduce((sum, s) => sum + s.closeCount, 0)
    const totalConversionRate = totalChats > 0 ? (totalOrders / totalChats) * 100 : 0
    const totalBookingAmount = salesReports.reduce((sum, s) => sum + s.bookingAmount, 0)
    const totalPaidAmount = salesReports.reduce((sum, s) => sum + s.paidAmount, 0)
    const totalDoneAmount = salesReports.reduce((sum, s) => sum + s.doneAmount, 0)
    const totalRealIncome = totalPaymentsIncome

    // Calculate services sold (period) - exclude free items and validity months only
    const serviceMap = new Map<string, { count: number; amount: number }>()
    orders?.forEach((order) => {
      order.order_items?.forEach((item: { products: { category: string | null; product_code: string | null; product_name: string | null; list_price: number; is_free: boolean | null; validity_months: number | null } | null }) => {
        if (item.products) {
          const product = item.products
          const productCode = product.product_code?.toUpperCase() || ''
          const productName = product.product_name?.toUpperCase() || ''

          const isFreeOrValidity =
            product.is_free ||
            productCode.includes('FREE') ||
            productName.includes('FREE') ||
            (product.validity_months && product.validity_months > 0)

          if (!isFreeOrValidity) {
            const category = product.category || 'Other'
            const existing = serviceMap.get(category) || { count: 0, amount: 0 }
            serviceMap.set(category, {
              count: existing.count + 1,
              amount: existing.amount + (product.list_price || 0),
            })
          }
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

    // Calculate 50% customers (period)
    const halfPriceOrders = orders?.filter((order) => {
      return order.order_items?.some((item: { products: { product_name: string; product_code: string } | null }) => {
        const productName = item.products?.product_name?.toUpperCase() || ''
        const productCode = item.products?.product_code?.toUpperCase() || ''
        return productName.includes('50%') || productCode.includes('50%')
      })
    }) || []

    const halfPriceCustomers = halfPriceOrders.length
    const halfPriceCustomersAmount = halfPriceOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

    // Calculate Master customers (period)
    const highValueOrders = orders?.filter((order) => {
      return (order.total_income || 0) >= 10000
    }) || []

    const highValueCustomers = highValueOrders.length
    const highValueAmount = highValueOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

    // Build period report data
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
      walkInCount,
      googleReviewCount,
      followUpClosed,
      masterBookingAmount,
      halfPriceCustomers,
      halfPriceCustomersAmount,
      highValueCustomers,
      highValueAmount,
      servicesSold,
    }

    // ==================== TODAY REPORT (selected date only) ====================

    const todayDateStr = endDateStr

    // Get orders for today only
    const { data: todayOrders } = await supabase
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
            product_code,
            category,
            list_price,
            is_free,
            validity_months
          )
        )
      `)
      .gte('created_at', `${todayDateStr}T00:00:00`)
      .lte('created_at', `${todayDateStr}T23:59:59`)

    // Get chat counts for today only
    const { data: todayChatCounts } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count, walk_in_count, google_review_count, follow_up_closed')
      .eq('date', todayDateStr)

    // Get payments for today only (by payment_date)
    const { data: todayPayments } = await supabase
      .from('payments')
      .select('order_id, amount')
      .gte('payment_date', todayDateStr)
      .lte('payment_date', todayDateStr)

    // Calculate today's metrics
    const todayWalkInCount = todayChatCounts?.reduce((sum, c) => sum + (c.walk_in_count || 0), 0) || 0
    const todayGoogleReviewCount = todayChatCounts?.reduce((sum, c) => sum + (c.google_review_count || 0), 0) || 0
    const todayFollowUpClosed = todayChatCounts?.reduce((sum, c) => sum + (c.follow_up_closed || 0), 0) || 0
    const todayPaymentsIncome = todayPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

    // Calculate stats for each staff (today only)
    const todaySalesReports = staff.map((s) => {
      const staffOrders = todayOrders?.filter((o) => o.sales_id === s.id) || []
      const staffOrderIds = staffOrders.map(o => o.id)
      const chatData = todayChatCounts?.find((c) => c.staff_id === s.id)
      const chatCount = chatData?.chat_count || 0

      const bookingOrders = staffOrders.filter((o) => o.order_status === 'booking')
      const paidOrders = staffOrders.filter((o) => o.order_status === 'paid')
      const doneOrders = staffOrders.filter((o) => o.order_status === 'done')

      const bookingAmount = staffOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const paidAmount = paidOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const doneAmount = doneOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

      // Real income from payments today - use ALL orders for attribution
      const allStaffOrderIds = allOrders?.filter(o => o.sales_id === s.id).map(o => o.id) || []
      const staffPayments = todayPayments?.filter(p => allStaffOrderIds.includes(p.order_id)) || []
      const realIncome = staffPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

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

    // Calculate today's totals
    const todayTotalChats = todaySalesReports.reduce((sum, s) => sum + s.chatCount, 0)
    const todayTotalOrders = todaySalesReports.reduce((sum, s) => sum + s.orderCount, 0)
    const todayTotalClose = todaySalesReports.reduce((sum, s) => sum + s.closeCount, 0)
    const todayTotalConversionRate = todayTotalChats > 0 ? (todayTotalOrders / todayTotalChats) * 100 : 0
    const todayTotalBookingAmount = todaySalesReports.reduce((sum, s) => sum + s.bookingAmount, 0)
    const todayTotalPaidAmount = todaySalesReports.reduce((sum, s) => sum + s.paidAmount, 0)
    const todayTotalDoneAmount = todaySalesReports.reduce((sum, s) => sum + s.doneAmount, 0)

    // Calculate today's services sold (exclude free items and validity months)
    const todayServiceMap = new Map<string, { count: number; amount: number }>()
    todayOrders?.forEach((order) => {
      order.order_items?.forEach((item: { products: { category: string | null; product_code: string | null; product_name: string | null; list_price: number; is_free: boolean | null; validity_months: number | null } | null }) => {
        if (item.products) {
          const product = item.products
          const productCode = product.product_code?.toUpperCase() || ''
          const productName = product.product_name?.toUpperCase() || ''

          const isFreeOrValidity =
            product.is_free ||
            productCode.includes('FREE') ||
            productName.includes('FREE') ||
            (product.validity_months && product.validity_months > 0)

          if (!isFreeOrValidity) {
            const category = product.category || 'Other'
            const existing = todayServiceMap.get(category) || { count: 0, amount: 0 }
            todayServiceMap.set(category, {
              count: existing.count + 1,
              amount: existing.amount + (product.list_price || 0),
            })
          }
        }
      })
    })

    const todayServicesSold = Array.from(todayServiceMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        amount: data.amount,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Calculate today's master bookings
    let todayMasterBookingAmount = 0
    todayOrders?.forEach((order) => {
      order.order_items?.forEach((item: { products: { list_price: number } | null }) => {
        if (item.products && item.products.list_price >= 20000) {
          todayMasterBookingAmount += item.products.list_price
        }
      })
    })

    // Calculate today's 50% customers (check both product_name and product_code)
    const todayHalfPriceOrders = todayOrders?.filter((order) => {
      return order.order_items?.some((item: { products: { product_name: string; product_code: string } | null }) => {
        const productName = item.products?.product_name?.toUpperCase() || ''
        const productCode = item.products?.product_code?.toUpperCase() || ''
        return productName.includes('50%') || productCode.includes('50%')
      })
    }) || []

    const todayHalfPriceCustomers = todayHalfPriceOrders.length
    const todayHalfPriceCustomersAmount = todayHalfPriceOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

    // Calculate today's Master customers (orders with total_income >= 10,000)
    const todayHighValueOrders = todayOrders?.filter((order) => {
      return (order.total_income || 0) >= 10000
    }) || []

    const todayHighValueCustomers = todayHighValueOrders.length
    const todayHighValueAmount = todayHighValueOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

    // Build today's report data
    const todayReportData: DailyReportData = {
      startDate: todayDateStr,
      endDate: todayDateStr,
      salesReports: todaySalesReports,
      totalChats: todayTotalChats,
      totalOrders: todayTotalOrders,
      totalClose: todayTotalClose,
      totalConversionRate: todayTotalConversionRate,
      totalBookingAmount: todayTotalBookingAmount,
      totalPaidAmount: todayTotalPaidAmount,
      totalDoneAmount: todayTotalDoneAmount,
      totalRealIncome: todayPaymentsIncome,
      walkInCount: todayWalkInCount,
      googleReviewCount: todayGoogleReviewCount,
      followUpClosed: todayFollowUpClosed,
      masterBookingAmount: todayMasterBookingAmount,
      halfPriceCustomers: todayHalfPriceCustomers,
      halfPriceCustomersAmount: todayHalfPriceCustomersAmount,
      highValueCustomers: todayHighValueCustomers,
      highValueAmount: todayHighValueAmount,
      servicesSold: todayServicesSold,
    }

    // ==================== SEND REPORTS VIA LINE ====================

    // Check LINE Messaging API token
    const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const userId = process.env.LINE_NOTIFY_USER_ID

    if (!channelToken || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'LINE_CHANNEL_ACCESS_TOKEN or LINE_NOTIFY_USER_ID not configured.',
          reportData,
          todayReportData
        },
        { status: 500 }
      )
    }

    console.log(`[Daily Report] Sending reports via LINE Messaging API...`)

    // 1. Send period summary report (26 - selected date)
    const summaryFlexMessage = createDailyReportFlex(reportData)
    const summaryResult = await sendLineFlexMessage({
      to: userId,
      altText: '📊 Summary Report',
      contents: summaryFlexMessage,
    })

    if (!summaryResult.success) {
      console.error(`[Daily Report] Failed to send period summary report: ${summaryResult.error}`)
    } else {
      console.log(`[Daily Report] Period summary report sent successfully`)
    }

    // Add small delay between messages
    await new Promise(resolve => setTimeout(resolve, 500))

    // 2. Send today's summary report (selected date only)
    const todaySummaryFlexMessage = createTodaySummaryFlex(todayReportData)
    const todaySummaryResult = await sendLineFlexMessage({
      to: userId,
      altText: '📊 Today Summary',
      contents: todaySummaryFlexMessage,
    })

    if (!todaySummaryResult.success) {
      console.error(`[Daily Report] Failed to send today summary report: ${todaySummaryResult.error}`)
    } else {
      console.log(`[Daily Report] Today summary report sent successfully`)
    }

    console.log(`[Daily Report] Reports sent - Period summary: ${summaryResult.success ? 'OK' : 'FAILED'}, Today summary: ${todaySummaryResult.success ? 'OK' : 'FAILED'}`)

    return NextResponse.json({
      success: summaryResult.success && todaySummaryResult.success,
      dateRange: `${startDateStr} to ${endDateStr}`,
      periodSummaryReportSent: summaryResult.success,
      todaySummaryReportSent: todaySummaryResult.success,
      reportData,
      todayReportData,
    })
  } catch (error) {
    console.error('[Daily Report] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
