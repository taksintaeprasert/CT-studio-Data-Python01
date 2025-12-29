'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Staff {
  id: number
  staff_name: string
  email: string
  role: 'admin' | 'sales' | 'artist'
}

type TabType = 'sales' | 'artist'

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('sales')
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  const [staffName, setStaffName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'sales' | 'artist'>('sales')

  const supabase = createClient()

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('is_active', true)
      .order('staff_name')

    setStaffList(data || [])
    setLoading(false)
  }

  const openModal = (staff?: Staff, defaultRole?: 'sales' | 'artist') => {
    if (staff) {
      setEditingStaff(staff)
      setStaffName(staff.staff_name)
      setEmail(staff.email)
      setRole(staff.role)
    } else {
      setEditingStaff(null)
      setStaffName('')
      setEmail('')
      setRole(defaultRole || activeTab)
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingStaff(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffName.trim() || !email.trim()) return

    if (editingStaff) {
      await supabase
        .from('staff')
        .update({
          staff_name: staffName.trim(),
          role,
        })
        .eq('id', editingStaff.id)
    } else {
      await supabase.from('staff').insert({
        staff_name: staffName.trim(),
        email: email.trim(),
        role,
      })
    }

    closeModal()
    fetchStaff()
  }

  const deleteStaff = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานนี้?')) return

    await supabase
      .from('staff')
      .update({ is_active: false })
      .eq('id', id)

    fetchStaff()
  }

  // Filter staff by tab
  const salesStaff = staffList.filter(s => s.role === 'sales' || s.role === 'admin')
  const artistStaff = staffList.filter(s => s.role === 'artist')
  const currentStaff = activeTab === 'sales' ? salesStaff : artistStaff

  // Stats
  const stats = {
    admin: staffList.filter(s => s.role === 'admin').length,
    sales: staffList.filter(s => s.role === 'sales').length,
    artist: staffList.filter(s => s.role === 'artist').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">พนักงาน</h1>
          <p className="text-gray-500 dark:text-gray-400">จัดการข้อมูลพนักงานทั้งหมด ({staffList.length} คน)</p>
        </div>
        <button onClick={() => openModal(undefined, activeTab)} className="btn btn-primary">
          + เพิ่ม{activeTab === 'sales' ? 'พนักงานขาย' : 'ช่าง'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">{stats.admin}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Admin</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.sales}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sales</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.artist}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Artist</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b dark:border-gray-700">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-6 py-3 font-medium transition-all border-b-2 -mb-px ${
            activeTab === 'sales'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          🛒 Sales / Admin ({salesStaff.length})
        </button>
        <button
          onClick={() => setActiveTab('artist')}
          className={`px-6 py-3 font-medium transition-all border-b-2 -mb-px ${
            activeTab === 'artist'
              ? 'text-purple-600 border-purple-600'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          🎨 Artist ({artistStaff.length})
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>อีเมล</th>
                <th>ตำแหน่ง</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currentStaff.map((staff) => {
                const badgeClass = staff.role === 'admin'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                  : staff.role === 'sales'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                const badgeLabel = staff.role === 'admin' ? 'Admin' : staff.role === 'sales' ? 'Sales' : 'Artist'

                return (
                  <tr key={staff.id}>
                    <td className="font-medium">{staff.staff_name}</td>
                    <td>{staff.email}</td>
                    <td>
                      <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(staff)}
                          className="text-blue-500 hover:text-blue-600 font-medium"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => deleteStaff(staff.id)}
                          className="text-red-500 hover:text-red-600 font-medium"
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {currentStaff.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 dark:text-gray-400 py-8">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              {editingStaff ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  อีเมล <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  disabled={!!editingStaff}
                  required
                />
                {editingStaff && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ไม่สามารถแก้ไขอีเมลได้</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ตำแหน่ง <span className="text-red-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'sales' | 'artist')}
                  className="select"
                  required
                >
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                  <option value="artist">Artist</option>
                </select>
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
