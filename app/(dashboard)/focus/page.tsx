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
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Focus Mode is only available for Sales role
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
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
    { id: 'create-order' as FocusStep, label: 'Create Order', number: 1 },
    { id: 'booking-queue' as FocusStep, label: 'Booking Queue', number: 2 },
    { id: 'check-in' as FocusStep, label: 'Check-in & Payment', number: 3 },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
              ⚡ Focus Mode
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Simplified workflow for creating orders and managing bookings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Exit Focus Mode
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 -z-10">
            <div
              className="h-full gradient-primary transition-all duration-300"
              style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Steps */}
          {steps.map((step, index) => {
            const isActive = step.id === currentStep
            const isCompleted = index < currentStepIndex

            return (
              <div key={step.id} className="flex flex-col items-center relative z-10">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all mb-2
                  ${isActive ? 'gradient-primary text-white shadow-lg scale-110' : ''}
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : ''}
                `}>
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  isActive ? 'text-pink-600 dark:text-pink-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            )
          })}
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
  )
}
