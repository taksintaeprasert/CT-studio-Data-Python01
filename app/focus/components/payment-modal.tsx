'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PaymentModalProps {
  orderId: number
  orderItemId: number
  remainingAmount: number
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({
  orderId,
  orderItemId,
  remainingAmount,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const supabase = createClient()

  const [amount, setAmount] = useState(remainingAmount.toString())
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [note, setNote] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('ขนาดไฟล์ต้องไม่เกิน 5MB')
        return
      }
      setReceiptFile(file)
    }
  }

  const handleSubmit = async () => {
    // Validate
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('กรุณากรอกจำนวนเงินที่ถูกต้อง')
      return
    }

    if (!paymentMethod) {
      alert('กรุณาเลือกช่องทางการจ่ายเงิน')
      return
    }

    setSaving(true)

    try {
      let receiptUrl = null
      let receiptPath = null

      // Upload receipt image if provided
      if (receiptFile) {
        setUploading(true)
        const fileName = `${Date.now()}_${receiptFile.name}`
        const filePath = `payment-receipts/${orderId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(filePath, receiptFile)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error('ไม่สามารถอัพโหลดรูปภาพได้')
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(filePath)

        receiptUrl = urlData.publicUrl
        receiptPath = filePath
        setUploading(false)
      }

      // Calculate credit card fee if applicable
      const creditCardFee = paymentMethod.toLowerCase() === 'credit card' ? amountNum * 0.03 : 0
      const netAmount = amountNum - creditCardFee

      // Insert payment record
      const { error: paymentError } = await supabase.from('payments').insert({
        order_id: orderId,
        amount: amountNum,
        payment_method: paymentMethod,
        credit_card_fee: creditCardFee,
        net_amount: netAmount,
        receipt_url: receiptUrl,
        receipt_path: receiptPath,
        note: note.trim() || null,
        payment_date: new Date().toISOString().split('T')[0],
      })

      if (paymentError) {
        console.error('Payment error:', paymentError)
        throw new Error('ไม่สามารถบันทึกการชำระเงินได้')
      }

      // Create system message in booking chat
      await supabase.from('booking_messages').insert({
        order_item_id: orderItemId,
        sender_type: 'system',
        message_type: 'text',
        message_text: `รับชำระเงิน ฿${amountNum.toLocaleString()} ผ่าน ${paymentMethod}${
          creditCardFee > 0 ? ` (ค่าธรรมเนียม ฿${creditCardFee.toLocaleString()})` : ''
        }`,
        is_read: false,
      })

      alert('✅ บันทึกการรับชำระเงินสำเร็จ!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error saving payment:', error)
      alert(error.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">💰 รับชำระเงิน</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              จำนวนเงิน (฿) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="input w-full text-lg font-semibold"
            />
            {remainingAmount > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ยอดคงเหลือ: ฿{remainingAmount.toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ช่องทางการชำระเงิน <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input w-full"
            >
              <option value="cash">💵 เงินสด (Cash)</option>
              <option value="bank transfer">🏦 โอนเงิน (Bank Transfer)</option>
              <option value="credit card">💳 บัตรเครดิต (Credit Card) +3%</option>
              <option value="promptpay">📱 พร้อมเพย์ (PromptPay)</option>
              <option value="other">📝 อื่นๆ (Other)</option>
            </select>
            {paymentMethod === 'credit card' && (
              <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
                ⚠️ มีค่าธรรมเนียม 3% (฿{(parseFloat(amount) * 0.03).toLocaleString()})
              </p>
            )}
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              อัพโหลดสลิปโอนเงิน (ไม่บังคับ)
            </label>
            <div className="flex items-center gap-2">
              <label className="flex-1 btn-secondary cursor-pointer text-center py-2">
                {receiptFile ? '✅ เลือกไฟล์แล้ว' : '📎 เลือกไฟล์รูปภาพ'}
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
              </label>
              {receiptFile && (
                <button
                  onClick={() => setReceiptFile(null)}
                  className="px-3 py-2 text-red-500 hover:text-red-700 font-medium"
                >
                  ลบ
                </button>
              )}
            </div>
            {receiptFile && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                📄 {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น งวดที่ 2, ชำระเต็มจำนวนแล้ว..."
              rows={2}
              className="input w-full resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button onClick={onClose} disabled={saving || uploading} className="btn-secondary flex-1 py-2">
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="btn-primary flex-1 py-2"
          >
            {uploading ? '📤 กำลังอัพโหลด...' : saving ? '💾 กำลังบันทึก...' : '✅ บันทึกการรับชำระ'}
          </button>
        </div>
      </div>
    </div>
  )
}
