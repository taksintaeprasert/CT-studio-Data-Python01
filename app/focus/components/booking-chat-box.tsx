'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import type { BookingMessage } from '@/lib/supabase/types'

interface BookingChatBoxProps {
  orderItemId: number
}

interface MessageWithSender extends BookingMessage {
  sender?: {
    staff_name: string
  } | null
}

export default function BookingChatBox({ orderItemId }: BookingChatBoxProps) {
  const supabase = createClient()
  const { user } = useUser()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [messageType, setMessageType] = useState<'text' | 'url' | 'file'>('text')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMessages()
  }, [orderItemId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('booking_messages')
      .select(`
        *,
        sender:staff!booking_messages_sender_id_fkey (staff_name)
      `)
      .eq('order_item_id', orderItemId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
    } else {
      setMessages(data || [])
    }
    setLoading(false)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      alert('กรุณาพิมพ์ข้อความ')
      return
    }

    try {
      const messageData: any = {
        order_item_id: orderItemId,
        sender_id: user?.id || null,
        sender_type: 'staff',
        message_type: messageType,
        is_read: false,
      }

      if (messageType === 'text') {
        messageData.message_text = newMessage.trim()
      } else if (messageType === 'url') {
        messageData.message_text = newMessage.trim()
      } else if (messageType === 'file') {
        // For now, just store as text URL until we implement file upload
        messageData.message_text = newMessage.trim()
        messageData.file_url = newMessage.trim()
      }

      const { error } = await supabase
        .from('booking_messages')
        .insert(messageData)

      if (error) throw error

      setNewMessage('')
      await loadMessages()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('เกิดข้อผิดพลาดในการส่งข้อความ')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}_${file.name}`
      const filePath = `booking-files/${orderItemId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('service-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('service-photos')
        .getPublicUrl(filePath)

      // Send message with file
      const { error: messageError } = await supabase
        .from('booking_messages')
        .insert({
          order_item_id: orderItemId,
          sender_id: user?.id || null,
          sender_type: 'staff',
          message_type: 'file',
          message_text: `แนบไฟล์: ${file.name}`,
          file_url: urlData.publicUrl,
          file_name: file.name,
          is_read: false,
        })

      if (messageError) throw messageError

      await loadMessages()
      e.target.value = ''
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('เกิดข้อผิดพลาดในการอัปโหลดไฟล์')
    } finally {
      setUploading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('th-TH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="text-center text-gray-500 py-4">กำลังโหลดข้อความ...</div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Messages List */}
      <div className="border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 h-80 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8">
            ยังไม่มีข้อความ เริ่มต้นการสนทนา...
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.sender_type === 'system'
            const senderName = isSystem ? 'ระบบ' : msg.sender?.staff_name || 'ไม่ทราบ'

            return (
              <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isSystem ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-center' : 'bg-white dark:bg-gray-700'} rounded-lg px-4 py-3 shadow-sm`}>
                  {!isSystem && (
                    <div className="text-xs font-medium text-pink-600 dark:text-pink-400 mb-1">
                      {senderName}
                    </div>
                  )}

                  {msg.message_type === 'text' && (
                    <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {msg.message_text}
                    </div>
                  )}

                  {msg.message_type === 'url' && (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-800 dark:text-gray-200">
                        {msg.message_text?.split('http')[0]}
                      </div>
                      <a
                        href={msg.message_text || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        🔗 {msg.message_text}
                      </a>
                    </div>
                  )}

                  {msg.message_type === 'file' && (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-800 dark:text-gray-200">
                        {msg.message_text}
                      </div>
                      {msg.file_url && (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          📎 {msg.file_name || 'ดาวน์โหลด'}
                        </a>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {formatTimestamp(msg.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        {/* Message Type Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setMessageType('text')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              messageType === 'text'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            💬 ข้อความ
          </button>
          <button
            onClick={() => setMessageType('url')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              messageType === 'url'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            🔗 URL
          </button>
          <label className={`px-3 py-1 text-sm rounded-lg transition-colors cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
            <span>📎 ไฟล์</span>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {/* Text Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              messageType === 'text' ? 'พิมพ์ข้อความ...' :
              messageType === 'url' ? 'วาง URL...' :
              'แนบไฟล์...'
            }
            className="input flex-1"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="btn-primary px-6"
          >
            ส่ง
          </button>
        </div>
      </div>
    </div>
  )
}
