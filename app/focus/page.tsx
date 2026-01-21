'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/user-context'
import CreateOrderStep from './components/create-order-step'
import BookingQueueStep from './components/booking-queue-step'
import CheckInStep from './components/check-in-step'

type FocusStep = 'create-order' | 'booking-queue' | 'check-in'

interface StepData {
  orderId?: number
  selectedOrderItemIds?: number[]
}

export default function FocusModePage() {
  const router = useRouter()
  const { user } = useUser()
  const [currentStep, setCurrentStep] = useState<FocusStep>('create-order')
  const [stepData, setStepData] = useState<StepData>({})

  // Only allow sales role
  if (user && user.role !== 'sales') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Focus Mode is only available for Sales role
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary w-full"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const handleOrderCreated = (orderId: number) => {
    setStepData({ ...stepData, orderId })
    setCurrentStep('booking-queue')
  }

  const handleBookingCompleted = (orderItemIds: number[]) => {
    setStepData({ ...stepData, selectedOrderItemIds: orderItemIds })
    setCurrentStep('check-in')
  }

  const handleReset = () => {
    setCurrentStep('create-order')
    setStepData({})
  }

  const steps = [
    { id: 'create-order' as FocusStep, label: 'สร้าง Order', number: 1 },
    { id: 'booking-queue' as FocusStep, label: 'ลงคิวช่าง', number: 2 },
    { id: 'check-in' as FocusStep, label: 'รับบริการ', number: 3 },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
                  Focus Mode
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Simplified sales workflow • {user?.staffName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                รีเซ็ต
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-5 py-2.5 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                ออกจาก Focus Mode
              </button>
            </div>
          </div>

          {/* Progress Stepper */}
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-6 left-0 right-0 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full -z-10">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const isActive = step.id === currentStep
                const isCompleted = index < currentStepIndex

                return (
                  <div key={step.id} className="flex flex-col items-center relative z-10 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 mb-3
                      ${isActive ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-2xl scale-125 ring-4 ring-pink-200 dark:ring-pink-900' : ''}
                      ${isCompleted ? 'bg-green-500 text-white shadow-lg' : ''}
                      ${!isActive && !isCompleted ? 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-500 shadow-md' : ''}
                    `}>
                      {isCompleted ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </div>
                    <span className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                      isActive ? 'text-pink-600 dark:text-pink-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div>
          {currentStep === 'create-order' && (
            <CreateOrderStep onOrderCreated={handleOrderCreated} />
          )}
          {currentStep === 'booking-queue' && stepData.orderId && (
            <BookingQueueStep
              orderId={stepData.orderId}
              onCompleted={handleBookingCompleted}
              onBack={() => setCurrentStep('create-order')}
            />
          )}
          {currentStep === 'check-in' && (
            <CheckInStep
              onBack={() => setCurrentStep('booking-queue')}
              onCompleted={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  )
}
