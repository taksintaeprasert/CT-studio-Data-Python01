'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'th'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

// Translations - Keep marketing/business terms in English even in Thai version
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.orders': 'Orders',
    'nav.appointments': 'Appointments',
    'nav.calendar': 'Calendar',
    'nav.customers': 'Customers',
    'nav.products': 'Products',
    'nav.sales': 'Sales Performance',
    'nav.staff': 'Staff',
    'nav.artistScore': 'Artist Score',
    'nav.satisfaction': 'Satisfaction Survey',
    'nav.logout': 'Logout',
    'nav.darkMode': 'Dark Mode',
    'nav.lightMode': 'Light Mode',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.totalBooking': 'Total Booking',
    'dashboard.totalIncome': 'Total Income',
    'dashboard.totalOrders': 'Total Orders',
    'dashboard.aov': 'AOV',
    'dashboard.aovNoUpsell': 'AOV (excl. Upsell)',
    'dashboard.upsellOrders': 'Upsell Orders',
    'dashboard.upsellRate': 'Upsell Rate',
    'dashboard.conversionRate': 'Conversion Rate',
    'dashboard.adsSpending': 'Ads Spending',
    'dashboard.roas': 'ROAS',
    'dashboard.costPerOrder': 'Cost per Order',
    'dashboard.ordersByChannel': 'Orders by Channel',
    'dashboard.marketingData': 'Marketing Data',
    'dashboard.overview': 'Overview',
    'dashboard.chatInquiries': 'Chat Inquiries',
    'dashboard.date': 'Date',
    'dashboard.save': 'Save',

    // Orders
    'orders.title': 'Orders',
    'orders.subtitle': 'View and manage all orders',
    'orders.newOrder': 'New Order',
    'orders.search': 'Search by name or phone...',
    'orders.status': 'Status',
    'orders.all': 'All',
    'orders.booking': 'Booking',
    'orders.paid': 'Paid',
    'orders.completed': 'Completed',
    'orders.cancelled': 'Cancelled',
    'orders.customer': 'Customer',
    'orders.createdAt': 'Created',
    'orders.total': 'Total',
    'orders.remaining': 'Remaining',
    'orders.noOrders': 'No orders found',

    // Appointments
    'appointments.title': 'Appointments',
    'appointments.subtitle': 'Manage orders and service appointments',
    'appointments.selectOrder': 'Select an order to view details',
    'appointments.services': 'Services',
    'appointments.manage': 'Manage',
    'appointments.receivePayment': 'Receive Payment',
    'appointments.cancel': 'Cancel',
    'appointments.edit': 'Edit',
    'appointments.artist': 'Artist',
    'appointments.selectArtist': 'Select Artist',
    'appointments.appointmentDate': 'Appointment Date',
    'appointments.time': 'Time',
    'appointments.serviceStatus': 'Service Status',
    'appointments.pending': 'Pending',
    'appointments.scheduled': 'Scheduled',

    // Calendar
    'calendar.title': 'Calendar',
    'calendar.subtitle': 'View appointments by date',
    'calendar.today': 'Today',
    'calendar.noAppointments': 'No appointments',
    'calendar.appointments': 'Appointments',
    'calendar.allArtists': 'All Artists',
    'calendar.filterByArtist': 'Filter by Artist',

    // Sales Performance
    'sales.title': 'Sales Performance',
    'sales.subtitle': 'Sales team performance analytics',
    'sales.totalSales': 'Total Sales',
    'sales.totalOrders': 'Total Orders',
    'sales.completed': 'Completed',
    'sales.avgUpsellRate': 'Avg Upsell Rate',
    'sales.salesByStaff': 'Sales by Staff',
    'sales.ordersByStaff': 'Orders by Staff',
    'sales.upsellRateByStaff': 'Upsell Rate by Staff',
    'sales.avgPerOrder': 'Avg/Order',
    'sales.completion': 'Completion',
    'sales.filterByStaff': 'Filter by Staff',
    'sales.allStaff': 'All Staff',
    'sales.noData': 'No data in this period',

    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.total': 'Total',
    'common.paid': 'Paid',
    'common.remaining': 'Remaining',
    'common.amount': 'Amount',
    'common.paymentMethod': 'Payment Method',
    'common.note': 'Note',
    'common.free': 'Free',
    'common.upsell': 'Upsell',
  },
  th: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.orders': 'คำสั่งซื้อ',
    'nav.appointments': 'นัดหมาย',
    'nav.calendar': 'ปฏิทิน',
    'nav.customers': 'ลูกค้า',
    'nav.products': 'สินค้า/บริการ',
    'nav.sales': 'Sales Performance',
    'nav.staff': 'พนักงาน',
    'nav.artistScore': 'Artist Score',
    'nav.satisfaction': 'ประเมินความพึงพอใจ',
    'nav.logout': 'ออกจากระบบ',
    'nav.darkMode': 'โหมดมืด',
    'nav.lightMode': 'โหมดสว่าง',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.totalBooking': 'Total Booking',
    'dashboard.totalIncome': 'Total Income',
    'dashboard.totalOrders': 'Total Orders',
    'dashboard.aov': 'AOV',
    'dashboard.aovNoUpsell': 'AOV (ไม่รวม Upsell)',
    'dashboard.upsellOrders': 'Upsell Orders',
    'dashboard.upsellRate': 'Upsell Rate',
    'dashboard.conversionRate': 'Conversion Rate',
    'dashboard.adsSpending': 'Ads Spending',
    'dashboard.roas': 'ROAS',
    'dashboard.costPerOrder': 'Cost per Order',
    'dashboard.ordersByChannel': 'Orders by Channel',
    'dashboard.marketingData': 'Marketing Data',
    'dashboard.overview': 'ภาพรวม',
    'dashboard.chatInquiries': 'จำนวนคนทักแชท',
    'dashboard.date': 'วันที่',
    'dashboard.save': 'บันทึก',

    // Orders
    'orders.title': 'คำสั่งซื้อ',
    'orders.subtitle': 'จัดการคำสั่งซื้อทั้งหมด',
    'orders.newOrder': 'สร้างคำสั่งซื้อ',
    'orders.search': 'ค้นหาด้วยชื่อหรือเบอร์โทร...',
    'orders.status': 'สถานะ',
    'orders.all': 'ทั้งหมด',
    'orders.booking': 'Booking',
    'orders.paid': 'Paid',
    'orders.completed': 'Completed',
    'orders.cancelled': 'Cancelled',
    'orders.customer': 'ลูกค้า',
    'orders.createdAt': 'วันที่สร้าง',
    'orders.total': 'ยอดรวม',
    'orders.remaining': 'ค้างชำระ',
    'orders.noOrders': 'ไม่พบคำสั่งซื้อ',

    // Appointments
    'appointments.title': 'นัดหมาย',
    'appointments.subtitle': 'จัดการ Order และนัดหมายบริการ',
    'appointments.selectOrder': 'เลือก Order เพื่อดูรายละเอียด',
    'appointments.services': 'บริการ',
    'appointments.manage': 'จัดการ',
    'appointments.receivePayment': 'รับชำระ',
    'appointments.cancel': 'ยกเลิก',
    'appointments.edit': 'แก้ไข',
    'appointments.artist': 'Artist',
    'appointments.selectArtist': 'เลือก Artist',
    'appointments.appointmentDate': 'วันนัด',
    'appointments.time': 'เวลา',
    'appointments.serviceStatus': 'สถานะบริการ',
    'appointments.pending': 'รอดำเนินการ',
    'appointments.scheduled': 'นัดหมายแล้ว',

    // Calendar
    'calendar.title': 'ปฏิทิน',
    'calendar.subtitle': 'ดูนัดหมายตามวันที่',
    'calendar.today': 'วันนี้',
    'calendar.noAppointments': 'ไม่มีนัดหมาย',
    'calendar.appointments': 'นัดหมาย',
    'calendar.allArtists': 'ทุก Artist',
    'calendar.filterByArtist': 'กรองตาม Artist',

    // Sales Performance
    'sales.title': 'Sales Performance',
    'sales.subtitle': 'วิเคราะห์ผลงานทีมขาย',
    'sales.totalSales': 'ยอดขายรวม',
    'sales.totalOrders': 'จำนวน Orders',
    'sales.completed': 'Completed',
    'sales.avgUpsellRate': 'Avg Upsell Rate',
    'sales.salesByStaff': 'ยอดขายตาม Staff',
    'sales.ordersByStaff': 'Orders ตาม Staff',
    'sales.upsellRateByStaff': 'Upsell Rate ตาม Staff',
    'sales.avgPerOrder': 'เฉลี่ย/Order',
    'sales.completion': 'Completion',
    'sales.filterByStaff': 'กรองตาม Staff',
    'sales.allStaff': 'ทุก Staff',
    'sales.noData': 'ไม่มีข้อมูลในช่วงเวลานี้',

    // Common
    'common.loading': 'กำลังโหลด...',
    'common.save': 'บันทึก',
    'common.cancel': 'ยกเลิก',
    'common.confirm': 'ยืนยัน',
    'common.yes': 'ใช่',
    'common.no': 'ไม่',
    'common.search': 'ค้นหา',
    'common.filter': 'กรอง',
    'common.total': 'ยอดรวม',
    'common.paid': 'ชำระแล้ว',
    'common.remaining': 'ค้างชำระ',
    'common.amount': 'จำนวนเงิน',
    'common.paymentMethod': 'วิธีชำระ',
    'common.note': 'หมายเหตุ',
    'common.free': 'ฟรี',
    'common.upsell': 'Upsell',
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('th')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('language') as Language
    if (saved && (saved === 'en' || saved === 'th')) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
  }

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  // Return children without context during SSR to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  // Return default values if not within LanguageProvider or during SSR
  if (context === undefined) {
    return {
      language: 'th' as Language,
      setLanguage: () => {},
      t: (key: string) => translations['th'][key] || key,
    }
  }
  return context
}
