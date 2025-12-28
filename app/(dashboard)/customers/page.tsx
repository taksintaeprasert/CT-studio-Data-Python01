'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: number
  full_name: string
  phone: string | null
  contact_channel: string | null
  note: string | null
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
    } else {
      setEditingCustomer(null)
      setFullName('')
      setPhone('')
      setContactChannel('')
      setNote('')
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

    if (editingCustomer) {
      await supabase
        .from('customers')
        .update({
          full_name: fullName.trim(),
          phone: phone || null,
          contact_channel: contactChannel || null,
          note: note || null,
        })
        .eq('id', editingCustomer.id)
    } else {
      await supabase.from('customers').insert({
        full_name: fullName.trim(),
        phone: phone || null,
        contact_channel: contactChannel || null,
        note: note || null,
      })
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
                <th>ช่องทาง</th>
                <th>หมายเหตุ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-medium">{customer.full_name}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>{customer.contact_channel || '-'}</td>
                  <td className="max-w-[200px] truncate">{customer.note || '-'}</td>
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
                  <td colSpan={5} className="text-center text-gray-500 py-8">
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
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">
              {editingCustomer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ <span className="text-red-500">*</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ช่องทางติดต่อ</label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input"
                  rows={3}
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
