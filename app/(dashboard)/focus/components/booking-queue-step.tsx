'use client'

interface BookingQueueStepProps {
  orderId: number
  onCompleted: (orderItemIds: number[]) => void
  onBack: () => void
}

export default function BookingQueueStep({ orderId, onCompleted, onBack }: BookingQueueStepProps) {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
        🎯 Booking Queue - Coming Soon
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Order ID: {orderId}
      </p>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        This step will allow you to schedule bookings for each service with calendar interface.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button
          onClick={() => onCompleted([])}
          className="btn-primary"
        >
          Continue to Check-in →
        </button>
      </div>
    </div>
  )
}
