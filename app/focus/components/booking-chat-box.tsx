'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import type { BookingMessage } from '@/lib/supabase/types'
import Image from 'next/image'

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
      return
    }

    try {
      // Detect if message contains URL
      const urlPattern = /https?:\/\/[^\s]+/gi
      const hasUrl = urlPattern.test(newMessage.trim())

      const messageData: any = {
        order_item_id: orderItemId,
        sender_id: user?.id || null,
        sender_type: 'staff',
        message_type: hasUrl ? 'url' : 'text',
        message_text: newMessage.trim(),
        is_read: false,
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

      // Determine if file is image
      const isImage = file.type.startsWith('image/')

      // Send message with file
      const { error: messageError } = await supabase
        .from('booking_messages')
        .insert({
          order_item_id: orderItemId,
          sender_id: user?.id || null,
          sender_type: 'staff',
          message_type: 'file',
          message_text: isImage ? '' : `แนบไฟล์: ${file.name}`,
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

  const isImageUrl = (url: string | null) => {
    if (!url) return false
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 py-8">กำลังโหลดข้อความ...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Messages List - Takes up available space */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400 dark:text-gray-500">
              ยังไม่มีข้อความ เริ่มต้นการสนทนา...
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.sender_type === 'system'
            const senderName = isSystem ? 'ระบบ' : msg.sender?.staff_name || 'ไม่ทราบ'

            return (
              <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[70%] ${
                  isSystem
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-center px-3 py-2 text-xs rounded-full'
                    : 'bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700'
                }`}>
                  {!isSystem && (
                    <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 mb-1">
                      {senderName}
                    </div>
                  )}

                  {msg.message_type === 'text' && (
                    <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                      {msg.message_text}
                    </div>
                  )}

                  {msg.message_type === 'url' && (
                    <a
                      href={msg.message_text || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      🔗 {msg.message_text}
                    </a>
                  )}

                  {msg.message_type === 'file' && (
                    <div className="space-y-2">
                      {isImageUrl(msg.file_url) ? (
                        <div className="relative">
                          <img
                            src={msg.file_url || ''}
                            alt={msg.file_name || 'รูปภาพ'}
                            className="rounded-xl max-w-full h-auto max-h-96 object-contain bg-gray-100 dark:bg-gray-900"
                          />
                        </div>
                      ) : (
                        <>
                          {msg.message_text && (
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {msg.message_text}
                            </div>
                          )}
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
                        </>
                      )}
                    </div>
                  )}

                  {!isSystem && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      {formatTimestamp(msg.created_at)}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 md:p-4">
        <div className="flex gap-2 items-end">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="พิมพ์ข้อความ..."
            className="input flex-1 resize-none"
            disabled={uploading}
          />

          {/* File Upload Button */}
          <label className={`btn-secondary px-3 py-2 md:px-4 cursor-pointer flex items-center justify-center ${uploading ? 'opacity-50' : ''}`}>
            <span className="text-lg">{uploading ? '📤' : '📎'}</span>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
            />
          </label>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="btn-primary px-4 md:px-6 py-2"
          >
            <span className="hidden md:inline">ส่ง</span>
            <span className="md:hidden">➤</span>
          </button>
        </div>
      </div>
    </div>
  )
}
