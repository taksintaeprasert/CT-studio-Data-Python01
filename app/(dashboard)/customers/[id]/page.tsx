'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, User, Phone, MapPin, Calendar, Heart, AlertCircle, Camera, CreditCard, TrendingUp, Clock, DollarSign } from 'lucide-react'
import Image from 'next/image'

interface Customer {
  id: number
  full_name: string
  phone: string | null
  nickname: string | null
  age: number | null
  province: string | null
  contact_channel: string | null
  source_channel: string | null
  medical_condition: string | null
  color_allergy: string | null
  drug_allergy: string | null
  face_photo_url: string | null
  note: string | null
  created_at: string
}

interface Order {
  id: number
  order_date: string
  appointment_date: string | null
  appointment_time: string | null
  order_status: string
  total_income: number
  deposit: number
  payment_method: string | null
  note: string | null
  created_at: string
  sales: {
    id: number
    staff_name: string
  } | null
  artist: {
    id: number
    staff_name: string
  } | null
  order_items: Array<{
    id: number
    item_price: number
    item_status: string
    is_upsell: boolean
    products: {
      product_code: string
      product_name: string
    } | null
  }>
  payments: Array<{
    id: number
    payment_date: string
    amount: number
    payment_method: string | null
    receipt_url: string | null
    note: string | null
  }>
}

interface ServicePhoto {
  id: number
  photo_url: string
  photo_type: string
  service_name: string | null
  created_at: string
}

interface CustomerStats {
  totalOrders: number
  totalSpent: number
  firstVisit: string | null
  lastVisit: string | null
  completedOrders: number
  pendingOrders: number
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = Number(params.id)
  const supabase = createClient()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [servicePhotos, setServicePhotos] = useState<ServicePhoto[]>([])
  const [stats, setStats] = useState<CustomerStats>({
    totalOrders: 0,
    totalSpent: 0,
    firstVisit: null,
    lastVisit: null,
    completedOrders: 0,
    pendingOrders: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (customerId) {
      fetchCustomerData()
    }
  }, [customerId])

  const fetchCustomerData = async () => {
    setLoading(true)
    try {
      // Fetch customer info
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) throw customerError
      setCustomer(customerData)

      // Fetch orders with all related data
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          sales:staff!orders_sales_id_fkey (id, staff_name),
          artist:staff!orders_artist_id_fkey (id, staff_name),
          order_items (
            id,
            item_price,
            item_status,
            is_upsell,
            products (product_code, product_name)
          ),
          payments (
            id,
            payment_date,
            amount,
            payment_method,
            receipt_url,
            note
          )
        `)
        .eq('customer_id', customerId)
        .order('order_date', { ascending: false })

      if (ordersError) throw ordersError
      setOrders(ordersData || [])

      // Calculate stats
      const totalOrders = ordersData?.length || 0
      const totalSpent = ordersData?.reduce((sum, order) => sum + Number(order.total_income || 0), 0) || 0
      const completedOrders = ordersData?.filter(o => o.order_status === 'done').length || 0
      const pendingOrders = ordersData?.filter(o => o.order_status !== 'done' && o.order_status !== 'cancel').length || 0
      const sortedOrders = [...(ordersData || [])].sort((a, b) =>
        new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
      )
      const firstVisit = sortedOrders[0]?.order_date || null
      const lastVisit = sortedOrders[sortedOrders.length - 1]?.order_date || null

      setStats({
        totalOrders,
        totalSpent,
        firstVisit,
        lastVisit,
        completedOrders,
        pendingOrders
      })

      // Fetch service photos
      const { data: photosData, error: photosError } = await supabase
        .from('service_photos')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (!photosError) {
        setServicePhotos(photosData || [])
      }

    } catch (error) {
      console.error('Error fetching customer data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      booking: { label: 'จอง', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      active: { label: 'กำลังดำเนินการ', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      done: { label: 'เสร็จสิ้น', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      cancel: { label: 'ยกเลิก', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
    }
    const { label, color } = statusMap[status] || { label: status, color: 'bg-gray-500/20 text-gray-400' }
    return <span className={`px-2 py-1 rounded-md text-xs font-medium border ${color}`}>{label}</span>
  }

  const getContactChannelDisplay = (channel: string | null) => {
    const channelMap: Record<string, string> = {
      line: 'LINE',
      facebook: 'Facebook',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      call: 'โทรศัพท์',
      walk_in: 'Walk-in'
    }
    return channelMap[channel || ''] || channel || '-'
  }

  const getSourceChannelDisplay = (source: string | null) => {
    const sourceMap: Record<string, string> = {
      google: 'Google',
      facebook: 'Facebook',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      line: 'LINE',
      refer: 'แนะนำ',
      walk_in: 'Walk-in',
      other: 'อื่นๆ'
    }
    return sourceMap[source || ''] || source || '-'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">กำลังโหลดข้อมูลลูกค้า...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">ไม่พบข้อมูลลูกค้า</h2>
          <button
            onClick={() => router.push('/customers')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            กลับไปหน้ารายการลูกค้า
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => router.push('/customers')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          กลับไปหน้ารายการลูกค้า
        </button>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 shadow-xl">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-1">
                <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden">
                  {customer.face_photo_url ? (
                    <Image
                      src={customer.face_photo_url}
                      alt={customer.full_name}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16 text-gray-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="flex-grow">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{customer.full_name}</h1>
                  {customer.nickname && (
                    <p className="text-lg text-purple-400">({customer.nickname})</p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">
                    ลูกค้าตั้งแต่ {new Date(customer.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">ช่องทางติดต่อ</div>
                    <div className="text-sm font-medium text-purple-300">
                      {getContactChannelDisplay(customer.contact_channel)}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">รู้จักจาก</div>
                    <div className="text-sm font-medium text-blue-300">
                      {getSourceChannelDisplay(customer.source_channel)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {customer.phone && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <Phone className="w-5 h-5 text-purple-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.age && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    <span>{customer.age} ปี</span>
                  </div>
                )}
                {customer.province && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <MapPin className="w-5 h-5 text-purple-400" />
                    <span>{customer.province}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <span className="text-3xl font-bold text-white">{stats.totalOrders}</span>
            </div>
            <p className="text-sm text-gray-300">จำนวนครั้งที่ใช้บริการ</p>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-sm rounded-xl border border-green-500/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-400" />
              <span className="text-3xl font-bold text-white">
                {stats.totalSpent.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-gray-300">ยอดรวมทั้งหมด (บาท)</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-blue-400" />
              <span className="text-xl font-bold text-white">
                {stats.firstVisit ? new Date(stats.firstVisit).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: '2-digit'
                }) : '-'}
              </span>
            </div>
            <p className="text-sm text-gray-300">ครั้งแรก</p>
          </div>

          <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/20 backdrop-blur-sm rounded-xl border border-pink-500/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-pink-400" />
              <span className="text-xl font-bold text-white">
                {stats.lastVisit ? new Date(stats.lastVisit).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: '2-digit'
                }) : '-'}
              </span>
            </div>
            <p className="text-sm text-gray-300">ครั้งล่าสุด</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Health Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Health Information */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-400" />
              ข้อมูลสุขภาพ
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">โรคประจำตัว</label>
                <p className="text-white bg-slate-700/50 rounded-lg p-3">
                  {customer.medical_condition || 'ไม่มีข้อมูล'}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">ประวัติแพ้สี</label>
                <p className="text-white bg-slate-700/50 rounded-lg p-3">
                  {customer.color_allergy || 'ไม่มีข้อมูล'}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">ประวัติแพ้ยา</label>
                <p className="text-white bg-slate-700/50 rounded-lg p-3">
                  {customer.drug_allergy || 'ไม่มีข้อมูล'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {customer.note && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">หมายเหตุ</h3>
              <p className="text-gray-300 whitespace-pre-wrap">{customer.note}</p>
            </div>
          )}

          {/* Service Photos */}
          {servicePhotos.length > 0 && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                รูปภาพบริการ ({servicePhotos.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {servicePhotos.map(photo => (
                  <a
                    key={photo.id}
                    href={photo.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500 transition-colors"
                  >
                    <Image
                      src={photo.photo_url}
                      alt={photo.service_name || 'Service photo'}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs">
                        {photo.photo_type}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Orders History */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">ประวัติการใช้บริการ ({orders.length} รายการ)</h3>

            {orders.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">ยังไม่มีประวัติการใช้บริการ</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="bg-slate-700/30 rounded-xl border border-slate-600/50 p-5 hover:border-purple-500/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">
                            Order #{order.id}
                          </h4>
                          {getStatusBadge(order.order_status)}
                        </div>
                        <p className="text-sm text-gray-400">
                          {new Date(order.order_date).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-400">
                          ฿{order.total_income.toLocaleString()}
                        </p>
                        {order.deposit > 0 && (
                          <p className="text-sm text-gray-400">
                            มัดจำ: ฿{order.deposit.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Order Items */}
                    {order.order_items && order.order_items.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 mb-2">รายการบริการ:</p>
                        <div className="space-y-1">
                          {order.order_items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-300">
                                {item.products?.product_name || item.products?.product_code}
                                {item.is_upsell && (
                                  <span className="ml-2 text-xs text-yellow-400">(Upsell)</span>
                                )}
                              </span>
                              <span className="text-purple-300">
                                ฿{item.item_price.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Staff Info */}
                    <div className="flex gap-4 text-sm text-gray-400 mb-4">
                      {order.sales && (
                        <span>Sales: {order.sales.staff_name}</span>
                      )}
                      {order.artist && (
                        <span>Artist: {order.artist.staff_name}</span>
                      )}
                    </div>

                    {/* Payment Receipts */}
                    {order.payments && order.payments.length > 0 && (
                      <div className="border-t border-slate-600/50 pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-gray-300">
                            ประวัติการชำระเงิน ({order.payments.length} รายการ)
                          </span>
                        </div>
                        <div className="space-y-2">
                          {order.payments.map(payment => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3"
                            >
                              <div className="flex-grow">
                                <p className="text-sm text-white">
                                  ฿{payment.amount.toLocaleString()}
                                  {payment.payment_method && (
                                    <span className="text-gray-400 ml-2">
                                      ({payment.payment_method})
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(payment.payment_date).toLocaleDateString('th-TH')}
                                </p>
                              </div>
                              {payment.receipt_url && (
                                <a
                                  href={payment.receipt_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-xs text-purple-300 transition-colors"
                                >
                                  ดูสลิป
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {order.note && (
                      <div className="mt-4 text-sm">
                        <span className="text-gray-400">หมายเหตุ: </span>
                        <span className="text-gray-300">{order.note}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
