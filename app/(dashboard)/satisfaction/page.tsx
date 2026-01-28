'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Staff {
  id: number
  staff_name: string
}

interface RatingOption {
  value: number
  label: string
  emoji: string
}

const SERVICE_CATEGORIES = [
  { id: 'Brow', label: 'Brow', icon: '💫' },
  { id: 'Lip', label: 'Lip', icon: '💋' },
  { id: 'Inliner', label: 'Inliner', icon: '👁️' },
  { id: 'Hair', label: 'Hair', icon: '💇' },
  { id: 'Pink Area', label: 'Pink Area', icon: '🌸' },
  { id: 'Other', label: 'Other', icon: '✨' },
]

const PAIN_LEVELS: RatingOption[] = [
  { value: 1, label: 'เจ็บที่สุด', emoji: '😭' },
  { value: 2, label: 'เจ็บมาก', emoji: '😣' },
  { value: 3, label: 'เจ็บปานกลาง', emoji: '😐' },
  { value: 4, label: 'เจ็บเล็กน้อย', emoji: '🙂' },
  { value: 5, label: 'ไม่เจ็บเลย', emoji: '😊' },
]

const QUALITY_RATINGS: RatingOption[] = [
  { value: 1, label: 'แย่มาก', emoji: '😞' },
  { value: 2, label: 'พอใช้', emoji: '😕' },
  { value: 3, label: 'ปานกลาง', emoji: '😐' },
  { value: 4, label: 'ดี', emoji: '😊' },
  { value: 5, label: 'ดีเยี่ยม', emoji: '🤩' },
]

export default function SatisfactionFormPage() {
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [step, setStep] = useState(1)
  const [artists, setArtists] = useState<Staff[]>([])
  const [selectedArtist, setSelectedArtist] = useState<number | null>(null)
  const [selectedService, setSelectedService] = useState<string>('')
  const [serviceOther, setServiceOther] = useState('')

  // Ratings
  const [painLevel, setPainLevel] = useState<number | null>(null)
  const [artistQuality, setArtistQuality] = useState<number | null>(null)
  const [resultSatisfaction, setResultSatisfaction] = useState<number | null>(null)
  const [frontDeskService, setFrontDeskService] = useState<number | null>(null)
  const [chatQuality, setChatQuality] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchArtists()
  }, [])

  const fetchArtists = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    setArtists(data || [])
    setLoading(false)
  }

  const handleNext = () => {
    setStep(step + 1)
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!selectedArtist) return

    setSubmitting(true)

    try {
      const response = await fetch('/api/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_id: selectedArtist,
          service_category: selectedService,
          service_other: selectedService === 'Other' ? serviceOther : null,
          pain_level: painLevel,
          artist_service_quality: artistQuality,
          result_satisfaction: resultSatisfaction,
          front_desk_service: frontDeskService,
          chat_response_quality: chatQuality,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setStep(8) // Success step
      } else {
        alert('เกิดข้อผิดพลาด: ' + result.error)
      }
    } catch (error) {
      console.error('Submit error:', error)
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล')
    } finally {
      setSubmitting(false)
    }
  }

  const canProceedStep2 = selectedArtist !== null
  const canProceedStep3 = selectedService !== '' && (selectedService !== 'Other' || serviceOther.trim() !== '')
  const canProceedStep4 = painLevel !== null
  const canProceedStep5 = artistQuality !== null
  const canProceedStep6 = resultSatisfaction !== null
  const canProceedStep7 = frontDeskService !== null

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Step {step > 7 ? 7 : step} of 7
            </span>
            <span className="text-sm font-medium text-pink-600 dark:text-pink-400">
              {Math.round(((step > 7 ? 7 : step) / 7) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${((step > 7 ? 7 : step) / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 transition-all duration-500">
          {/* Step 1: Select Artist */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  เลือกช่างที่ทำบริการให้คุณ
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  กรุณาเลือกช่างที่ให้บริการคุณวันนี้
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {artists.map((artist) => (
                  <button
                    key={artist.id}
                    onClick={() => setSelectedArtist(artist.id)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                      selectedArtist === artist.id
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                        selectedArtist === artist.id
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        👤
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                          {artist.staff_name}
                        </p>
                      </div>
                      {selectedArtist === artist.id && (
                        <div className="text-pink-500 text-2xl">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={!canProceedStep2}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
              >
                ถัดไป →
              </button>
            </div>
          )}

          {/* Step 2: Select Service */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  เลือกบริการที่รับ
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  กรุณาเลือกบริการที่คุณได้รับวันนี้
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {SERVICE_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedService(category.id)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      selectedService === category.id
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">{category.icon}</div>
                      <p className="font-bold text-gray-800 dark:text-white">
                        {category.label}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {selectedService === 'Other' && (
                <div className="mt-4 animate-fade-in">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    กรุณาระบุบริการอื่นๆ
                  </label>
                  <input
                    type="text"
                    value={serviceOther}
                    onChange={(e) => setServiceOther(e.target.value)}
                    placeholder="พิมพ์ชื่อบริการ..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-pink-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-2xl font-bold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedStep3}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                >
                  ถัดไป →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Pain Level */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  ระดับความเจ็บระหว่างทำ
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  คุณรู้สึกเจ็บมากน้อยแค่ไหนระหว่างรับบริการ?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {PAIN_LEVELS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPainLevel(option.value)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      painLevel === option.value
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{option.emoji}</div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-lg text-gray-800 dark:text-white">
                          {option.label}
                        </p>
                      </div>
                      {painLevel === option.value && (
                        <div className="text-pink-500 text-2xl">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-2xl font-bold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedStep4}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                >
                  ถัดไป →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Artist Service Quality */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  การให้บริการของช่าง
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  คุณพอใจการให้บริการของช่างมากน้อยแค่ไหน?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {QUALITY_RATINGS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setArtistQuality(option.value)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      artistQuality === option.value
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{option.emoji}</div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-lg text-gray-800 dark:text-white">
                          {option.label}
                        </p>
                      </div>
                      {artistQuality === option.value && (
                        <div className="text-pink-500 text-2xl">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-2xl font-bold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedStep5}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                >
                  ถัดไป →
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Result Satisfaction */}
          {step === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  ความพึงพอใจหลังทำ
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  คุณพอใจกับผลลัพธ์หลังรับบริการมากน้อยแค่ไหน?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {QUALITY_RATINGS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setResultSatisfaction(option.value)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      resultSatisfaction === option.value
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{option.emoji}</div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-lg text-gray-800 dark:text-white">
                          {option.label}
                        </p>
                      </div>
                      {resultSatisfaction === option.value && (
                        <div className="text-pink-500 text-2xl">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-2xl font-bold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedStep6}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                >
                  ถัดไป →
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Front Desk Service */}
          {step === 6 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  การบริการหน้าร้าน
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  คุณพอใจการบริการหน้าร้านมากน้อยแค่ไหน?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {QUALITY_RATINGS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFrontDeskService(option.value)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      frontDeskService === option.value
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{option.emoji}</div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-lg text-gray-800 dark:text-white">
                          {option.label}
                        </p>
                      </div>
                      {frontDeskService === option.value && (
                        <div className="text-pink-500 text-2xl">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-2xl font-bold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedStep7}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                >
                  ถัดไป →
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Chat Response Quality */}
          {step === 7 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  การตอบแชท
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  คุณพอใจการตอบแชทและการติดต่อมากน้อยแค่ไหน?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {QUALITY_RATINGS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setChatQuality(option.value)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                      chatQuality === option.value
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{option.emoji}</div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-lg text-gray-800 dark:text-white">
                          {option.label}
                        </p>
                      </div>
                      {chatQuality === option.value && (
                        <div className="text-pink-500 text-2xl">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-2xl font-bold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={chatQuality === null || submitting}
                  className="flex-1 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                >
                  {submitting ? 'กำลังส่ง...' : 'ส่งแบบประเมิน ✓'}
                </button>
              </div>
            </div>
          )}

          {/* Step 8: Success */}
          {step === 8 && (
            <div className="text-center space-y-6 animate-fade-in">
              <div className="text-8xl mb-6">🎉</div>
              <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
                ขอบคุณสำหรับคำติชม!
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
                ความคิดเห็นของคุณมีค่ามาก และจะช่วยให้เราปรับปรุงการบริการให้ดียิ่งขึ้น
              </p>
              <button
                onClick={() => router.push('/sales')}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all duration-300"
              >
                กลับหน้าหลัก
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}
