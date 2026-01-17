'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

import { StaffRole } from '@/lib/supabase/types'
import { useUser } from '@/lib/user-context'

interface Staff {
  id: number
  staff_name: string
  email: string
  role: StaffRole
}

type TabType = 'sales' | 'artist' | 'all'

// Role configuration
const roleConfig: Record<StaffRole, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' },
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  marketer: { label: 'Marketer', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  sales: { label: 'Sales', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  artist: { label: 'Artist', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
}

export default function StaffPage() {
  const { user } = useUser()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('sales')
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  const [staffName, setStaffName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('sales')

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

  const openModal = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff)
      setStaffName(staff.staff_name)
      setEmail(staff.email)
      setRole(staff.role)
    } else {
      setEditingStaff(null)
      setStaffName('')
      setEmail('')
      setRole('sales')
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
  const salesStaff = staffList.filter(s => ['sales', 'admin', 'marketer', 'super_admin'].includes(s.role))
  const artistStaff = staffList.filter(s => s.role === 'artist')
  const currentStaff = activeTab === 'all' ? staffList : (activeTab === 'sales' ? salesStaff : artistStaff)

  // Stats
  const stats = {
    super_admin: staffList.filter(s => s.role === 'super_admin').length,
    admin: staffList.filter(s => s.role === 'admin').length,
    marketer: staffList.filter(s => s.role === 'marketer').length,
    sales: staffList.filter(s => s.role === 'sales').length,
    artist: staffList.filter(s => s.role === 'artist').length,
  }

  // Check if current user can manage staff
  const canManageStaff = user?.role === 'super_admin' || user?.role === 'admin'

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
        {canManageStaff && (
          <button onClick={() => openModal()} className="btn btn-primary">
            + เพิ่มพนักงาน
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-pink-600">{stats.super_admin}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Super Admin</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">{stats.admin}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Admin</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{stats.marketer}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Marketer</p>
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
      <div className="flex gap-2 border-b dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'all'
              ? 'text-pink-600 border-pink-600'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          ทั้งหมด ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'sales'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Sales / Admin ({salesStaff.length})
        </button>
        <button
          onClick={() => setActiveTab('artist')}
          className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'artist'
              ? 'text-purple-600 border-purple-600'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Artist ({artistStaff.length})
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
                {canManageStaff && <th></th>}
              </tr>
            </thead>
            <tbody>
              {currentStaff.map((staff) => {
                const config = roleConfig[staff.role] || { label: staff.role, color: 'bg-gray-100 text-gray-700' }

                return (
                  <tr key={staff.id}>
                    <td className="font-medium">{staff.staff_name}</td>
                    <td>{staff.email}</td>
                    <td>
                      <span className={`badge ${config.color}`}>{config.label}</span>
                    </td>
                    {canManageStaff && (
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
                    )}
                  </tr>
                )
              })}
              {currentStaff.length === 0 && (
                <tr>
                  <td colSpan={canManageStaff ? 4 : 3} className="text-center text-gray-500 dark:text-gray-400 py-8">
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
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="select"
                  required
                >
                  {user?.role === 'super_admin' && (
                    <option value="super_admin">Super Admin</option>
                  )}
                  <option value="admin">Admin</option>
                  <option value="marketer">Marketer</option>
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
