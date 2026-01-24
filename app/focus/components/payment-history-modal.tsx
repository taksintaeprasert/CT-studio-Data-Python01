'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Payment {
  id: number
  order_id: number
  amount: number
  payment_method: string
  payment_date: string
  credit_card_fee: number
  net_amount: number
  note: string | null
  receipt_url: string | null
  created_at: string
}

interface Order {
  id: number
  deposit: number
  created_at: string
}

interface PaymentHistoryModalProps {
  orderId: number
  onClose: () => void
  onUpdate: () => void
}

export default function PaymentHistoryModal({
  orderId,
  onClose,
  onUpdate,
}: PaymentHistoryModalProps) {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editingDeposit, setEditingDeposit] = useState(false)
  const [depositDate, setDepositDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [orderId])

  const fetchData = async () => {
    setLoading(true)

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('payment_date', { ascending: false })

    // Fetch order (for deposit info)
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, deposit, created_at')
      .eq('id', orderId)
      .single()

    if (paymentsData) setPayments(paymentsData)
    if (orderData) setOrder(orderData)

    setLoading(false)
  }

  const handleDeleteDeposit = async () => {
    if (!confirm('คุณต้องการลบเงินมัดจำใช่หรือไม่?\n(จะตั้งค่าเป็น ฿0)')) {
      return
    }

    const { error } = await supabase
      .from('orders')
      .update({ deposit: 0 })
      .eq('id', orderId)

    if (error) {
      alert(`ไม่สามารถลบได้: ${error.message}`)
      return
    }

    alert('✅ ลบเงินมัดจำสำเร็จ')
    await fetchData()
    onUpdate()
  }

  const handleEditDepositDate = () => {
    if (!order) return
    setEditingDeposit(true)
    setDepositDate(order.created_at.split('T')[0])
  }

  const handleSaveDepositDate = async () => {
    const { error } = await supabase
      .from('orders')
      .update({ created_at: `${depositDate}T12:00:00` })
      .eq('id', orderId)

    if (error) {
      alert(`ไม่สามารถบันทึกได้: ${error.message}`)
      return
    }

    alert('✅ แก้ไขวันที่เงินมัดจำสำเร็จ')
    setEditingDeposit(false)
    await fetchData()
    onUpdate()
  }

  const handleDelete = async (paymentId: number) => {
    if (!confirm('คุณต้องการลบรายการชำระเงินนี้ใช่หรือไม่?')) {
      return
    }

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId)

    if (error) {
      alert(`ไม่สามารถลบได้: ${error.message}`)
      return
    }

    alert('✅ ลบรายการสำเร็จ')
    await fetchData()
    onUpdate() // Refresh parent data
  }

  const handleEditDate = (payment: Payment) => {
    setEditingPayment(payment)
    setEditDate(payment.payment_date)
  }

  const handleSaveDate = async () => {
    if (!editingPayment) return

    const { error } = await supabase
      .from('payments')
      .update({ payment_date: editDate })
      .eq('id', editingPayment.id)

    if (error) {
      alert(`ไม่สามารถบันทึกได้: ${error.message}`)
      return
    }

    alert('✅ แก้ไขวันที่สำเร็จ')
    setEditingPayment(null)
    await fetchData()
    onUpdate() // Refresh parent data
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPaymentMethodDisplay = (method: string) => {
    const methods: Record<string, string> = {
      'cash': '💵 เงินสด',
      'bank transfer': '🏦 โอนเงิน',
      'credit card': '💳 บัตรเครดิต',
      'promptpay': '📱 พร้อมเพย์',
      'other': '📝 อื่นๆ',
    }
    return methods[method.toLowerCase()] || method
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              📋 ประวัติการรับชำระเงิน - Order #{orderId}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              กำลังโหลด...
            </div>
          ) : (
            <div className="space-y-3">
              {/* Deposit (Initial Payment) */}
              {order && order.deposit > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Deposit Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">
                          เงินมัดจำ
                        </span>
                        <span className="text-xl font-bold text-blue-600">
                          ฿{order.deposit.toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">วิธีชำระ: </span>
                          <span className="font-medium text-gray-800 dark:text-white">
                            เงินมัดจำ (สร้าง Order)
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">วันที่: </span>
                          <span className="font-medium text-blue-600">
                            {formatDate(order.created_at)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">บันทึกเมื่อ: </span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {formatDateTime(order.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleEditDepositDate}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
                      >
                        แก้ไขวันที่
                      </button>
                      <button
                        onClick={handleDeleteDeposit}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Records */}
              {payments.length === 0 && (!order || order.deposit === 0) ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 text-lg">ยังไม่มีรายการชำระเงิน</p>
                </div>
              ) : (
                payments.map((payment, index) => (
                <div
                  key={payment.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border-l-4 border-pink-500"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Payment Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          #{payments.length - index}
                        </span>
                        <span className={`text-xl font-bold ${payment.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {payment.amount < 0 ? '-' : '+'}฿{Math.abs(payment.amount).toLocaleString()}
                        </span>
                        {payment.credit_card_fee > 0 && (
                          <span className="text-xs text-orange-500 dark:text-orange-400">
                            ค่าธรรมเนียม ฿{payment.credit_card_fee.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">วิธีชำระ: </span>
                          <span className="font-medium text-gray-800 dark:text-white">
                            {getPaymentMethodDisplay(payment.payment_method)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">วันที่รับชำระ: </span>
                          <span className="font-medium text-pink-600">
                            {formatDate(payment.payment_date)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">บันทึกเมื่อ: </span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {formatDateTime(payment.created_at)}
                          </span>
                        </div>
                        {payment.note && (
                          <div className="col-span-2">
                            <span className="text-gray-500 dark:text-gray-400">หมายเหตุ: </span>
                            <span className="text-gray-700 dark:text-gray-200">{payment.note}</span>
                          </div>
                        )}
                      </div>

                      {payment.receipt_url && (
                        <a
                          href={payment.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-xs text-blue-500 hover:text-blue-700 underline"
                        >
                          📎 ดูสลิปการโอนเงิน
                        </a>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleEditDate(payment)}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
                      >
                        แก้ไขวันที่
                      </button>
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary w-full py-2">
            ปิด
          </button>
        </div>
      </div>

      {/* Edit Date Modal (for payment records) */}
      {editingPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              แก้ไขวันที่รับชำระ
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                วันที่รับชำระเงิน
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                💡 การเปลี่ยนวันที่จะส่งผลต่อยอด Income ในหน้า Dashboard
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingPayment(null)}
                className="btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveDate}
                className="btn-primary flex-1"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deposit Date Modal */}
      {editingDeposit && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              แก้ไขวันที่เงินมัดจำ
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                วันที่สร้าง Order (เงินมัดจำ)
              </label>
              <input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                💡 การเปลี่ยนวันที่จะส่งผลต่อยอด Booking และ Income ในหน้า Dashboard
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingDeposit(false)}
                className="btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveDepositDate}
                className="btn-primary flex-1"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
