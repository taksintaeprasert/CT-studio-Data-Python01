'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: number
  full_name: string
  phone: string | null
  contact_channel: string | null
  note: string | null
  province: string | null
  age: number | null
  source_channel: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

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
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    setCustomers(data || [])
    setLoading(false)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ลูกค้า</h1>
          <p className="text-gray-500">จัดการข้อมูลลูกค้าทั้งหมด ({customers.length} คน)</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          + เพิ่มลูกค้า
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input"
      />

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>เบอร์โทร</th>
                <th>จังหวัด</th>
                <th>อายุ</th>
                <th>รู้จักจาก</th>
                <th>ช่องทางติดต่อ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-medium">{customer.full_name}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>{customer.province || '-'}</td>
                  <td>{customer.age || '-'}</td>
                  <td>
                    {customer.source_channel ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300">
                        {sourceChannels.find(s => s.value === customer.source_channel)?.label || customer.source_channel}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{customer.contact_channel || '-'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(customer)}
                        className="text-blue-500 hover:text-blue-600 font-medium"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        className="text-red-500 hover:text-red-600 font-medium"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-8">
                    ไม่พบรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              {editingCustomer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เบอร์โทร</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    placeholder="0xx-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อายุ</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="input"
                    placeholder="เช่น 25"
                    min="1"
                    max="120"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">จังหวัด</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="select"
                  >
                    <option value="">เลือกจังหวัด</option>
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รู้จักจากช่องทาง</label>
                  <select
                    value={sourceChannel}
                    onChange={(e) => setSourceChannel(e.target.value)}
                    className="select"
                  >
                    <option value="">เลือกช่องทาง</option>
                    {sourceChannels.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ช่องทางติดต่อ</label>
                  <select
                    value={contactChannel}
                    onChange={(e) => setContactChannel(e.target.value)}
                    className="select"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมายเหตุ</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="บันทึกเพิ่มเติม..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
