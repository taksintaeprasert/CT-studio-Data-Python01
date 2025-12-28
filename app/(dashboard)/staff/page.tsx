'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Staff {
  id: number
  staff_name: string
  email: string
  role: 'admin' | 'sales' | 'artist'
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
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
      .order('role')
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

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      admin: { class: 'bg-red-100 text-red-700', label: 'Admin' },
      sales: { class: 'bg-blue-100 text-blue-700', label: 'Sales' },
      artist: { class: 'bg-purple-100 text-purple-700', label: 'Artist' },
    }
    return badges[role] || { class: 'bg-gray-100 text-gray-700', label: role }
  }

  const filteredStaff = staffList.filter(s =>
    !roleFilter || s.role === roleFilter
  )

  // Stats
  const stats = {
    admin: staffList.filter(s => s.role === 'admin').length,
    sales: staffList.filter(s => s.role === 'sales').length,
    artist: staffList.filter(s => s.role === 'artist').length,
  }

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
          <h1 className="text-2xl font-bold text-gray-800">พนักงาน</h1>
          <p className="text-gray-500">จัดการข้อมูลพนักงานทั้งหมด ({staffList.length} คน)</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          + เพิ่มพนักงาน
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">{stats.admin}</p>
          <p className="text-sm text-gray-500">Admin</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.sales}</p>
          <p className="text-sm text-gray-500">Sales</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.artist}</p>
          <p className="text-sm text-gray-500">Artist</p>
        </div>
      </div>

      {/* Filter */}
      <select
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value)}
        className="select w-full sm:w-48"
      >
        <option value="">ตำแหน่งทั้งหมด</option>
        <option value="admin">Admin</option>
        <option value="sales">Sales</option>
        <option value="artist">Artist</option>
      </select>

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
              {filteredStaff.map((staff) => {
                const badge = getRoleBadge(staff.role)
                return (
                  <tr key={staff.id}>
                    <td className="font-medium">{staff.staff_name}</td>
                    <td className="text-gray-600">{staff.email}</td>
                    <td>
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
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
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 py-8">
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
              {editingStaff ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <p className="text-xs text-gray-500 mt-1">ไม่สามารถแก้ไขอีเมลได้</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
