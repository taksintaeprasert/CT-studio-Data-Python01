'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CustomerHistoryModal from '@/components/customer-history-modal'
import { User, Phone, MapPin, TrendingUp, Eye, Edit2, Trash2, Plus, Search } from 'lucide-react'
import Image from 'next/image'

interface Customer {
  id: number
  full_name: string
  phone: string | null
  contact_channel: string | null
  note: string | null
  province: string | null
  age: number | null
  source_channel: string | null
  face_photo_url: string | null
  created_at: string
}

interface CustomerWithStats extends Customer {
  totalOrders: number
  totalSpent: number
  lastVisit: string | null
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [contactChannel, setContactChannel] = useState('')
  const [note, setNote] = useState('')
  const [province, setProvince] = useState('')
  const [age, setAge] = useState('')
  const [sourceChannel, setSourceChannel] = useState('')

  // Thai provinces list
  const provinces = [
    'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร',
    'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
    'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง',
    'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
    'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส',
    'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
    'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พังงา', 'พัทลุง',
    'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่',
    'พะเยา', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน',
    'ยะลา', 'ยโสธร', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง',
    'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
    'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
    'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
    'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย',
    'หนองบัวลำภู', 'อ่างทอง', 'อุดรธานี', 'อุทัยธานี', 'อุตรดิตถ์',
    'อุบลราชธานี', 'อำนาจเจริญ'
  ]

  // Source channels
  const sourceChannels = [
    { value: 'google', label: 'Google' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'line', label: 'LINE' },
    { value: 'refer', label: 'เพื่อนแนะนำ (Refer)' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'other', label: 'อื่นๆ' },
  ]

  const supabase = createClient()

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!customersData) {
        setCustomers([])
        setLoading(false)
        return
      }

      // Fetch orders for all customers to calculate stats
      const { data: ordersData } = await supabase
        .from('orders')
        .select('customer_id, order_date, total_income, order_status')

      // Calculate stats for each customer
      const customersWithStats = customersData.map(customer => {
        const customerOrders = ordersData?.filter(o => o.customer_id === customer.id) || []
        const totalOrders = customerOrders.length
        const totalSpent = customerOrders.reduce((sum, order) => sum + Number(order.total_income || 0), 0)
        const sortedOrders = [...customerOrders].sort((a, b) =>
          new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
        )
        const lastVisit = sortedOrders[0]?.order_date || null

        return {
          ...customer,
          totalOrders,
          totalSpent,
          lastVisit
        }
      })

      setCustomers(customersWithStats)
    } catch (error) {
      console.error('Error fetching customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFullName(customer.full_name)
      setPhone(customer.phone || '')
      setContactChannel(customer.contact_channel || '')
      setNote(customer.note || '')
      setProvince(customer.province || '')
      setAge(customer.age ? String(customer.age) : '')
      setSourceChannel(customer.source_channel || '')
    } else {
      setEditingCustomer(null)
      setFullName('')
      setPhone('')
      setContactChannel('')
      setNote('')
      setProvince('')
      setAge('')
      setSourceChannel('')
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCustomer(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return

    const customerData = {
      full_name: fullName.trim(),
      phone: phone || null,
      contact_channel: contactChannel || null,
      note: note || null,
      province: province || null,
      age: age ? parseInt(age) : null,
      source_channel: sourceChannel || null,
    }

    if (editingCustomer) {
      await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingCustomer.id)
    } else {
      await supabase.from('customers').insert(customerData)
    }

    closeModal()
    fetchCustomers()
  }

  const deleteCustomer = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้านี้?')) return

    await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)

    fetchCustomers()
  }

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">กำลังโหลดข้อมูลลูกค้า...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">ลูกค้าทั้งหมด</h1>
            <p className="text-gray-400 mt-1">จัดการข้อมูลลูกค้าและติดตามประวัติการใช้บริการ</p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/30"
          >
            <Plus className="w-5 h-5" />
            เพิ่มลูกค้าใหม่
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">ลูกค้าทั้งหมด</p>
                <p className="text-3xl font-bold text-white">{customers.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">ยอดรวมทั้งหมด</p>
                <p className="text-3xl font-bold text-white">
                  ฿{customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">จำนวนครั้งเฉลี่ย</p>
                <p className="text-3xl font-bold text-white">
                  {customers.length > 0
                    ? (customers.reduce((sum, c) => sum + c.totalOrders, 0) / customers.length).toFixed(1)
                    : '0'
                  }
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {/* Customers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 hover:border-purple-500/50 transition-all cursor-pointer group"
              onClick={() => router.push(`/customers/${customer.id}`)}
            >
              {/* Customer Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-0.5 flex-shrink-0">
                  <div className="w-full h-full rounded-[11px] bg-slate-900 flex items-center justify-center overflow-hidden">
                    {customer.face_photo_url ? (
                      <Image
                        src={customer.face_photo_url}
                        alt={customer.full_name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-gray-500" />
                    )}
                  </div>
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                    {customer.full_name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                    {customer.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                    )}
                  </div>
                  {customer.province && (
                    <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{customer.province}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">ครั้ง</p>
                  <p className="text-lg font-bold text-purple-400">{customer.totalOrders}</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3 text-center col-span-2">
                  <p className="text-xs text-gray-400 mb-1">ยอดรวม</p>
                  <p className="text-lg font-bold text-green-400">
                    ฿{customer.totalSpent.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {customer.source_channel && (
                  <span className="px-2 py-1 text-xs rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    {sourceChannels.find(s => s.value === customer.source_channel)?.label || customer.source_channel}
                  </span>
                )}
                {customer.contact_channel && (
                  <span className="px-2 py-1 text-xs rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {customer.contact_channel}
                  </span>
                )}
                {customer.age && (
                  <span className="px-2 py-1 text-xs rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {customer.age} ปี
                  </span>
                )}
              </div>

              {/* Last Visit */}
              {customer.lastVisit && (
                <p className="text-xs text-gray-500 mb-4">
                  ครั้งล่าสุด: {new Date(customer.lastVisit).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/customers/${customer.id}`)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  ดูรายละเอียด
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openModal(customer)
                  }}
                  className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteCustomer(customer.id)
                  }}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <div className="col-span-full text-center py-12">
              <User className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">ไม่พบรายการลูกค้า</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">
              {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ชื่อ-นามสกุล <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">เบอร์โทร</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="0xx-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">อายุ</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="เช่น 25"
                    min="1"
                    max="120"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">จังหวัด</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="">เลือกจังหวัด</option>
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">รู้จักจากช่องทาง</label>
                  <select
                    value={sourceChannel}
                    onChange={(e) => setSourceChannel(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="">เลือกช่องทาง</option>
                    {sourceChannels.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ช่องทางติดต่อ</label>
                  <select
                    value={contactChannel}
                    onChange={(e) => setContactChannel(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="">เลือกช่องทาง</option>
                    <option value="LINE">LINE</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="โทรศัพท์">โทรศัพท์</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">หมายเหตุ</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  rows={2}
                  placeholder="บันทึกเพิ่มเติม..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all font-medium"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {historyCustomer && (
        <CustomerHistoryModal
          customerId={historyCustomer.id}
          customerName={historyCustomer.full_name}
          onClose={() => setHistoryCustomer(null)}
        />
      )}
    </div>
  )
}
