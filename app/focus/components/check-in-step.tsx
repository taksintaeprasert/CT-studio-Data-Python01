'use client'

interface CheckInStepProps {
  onBack: () => void
  onCompleted: () => void
}

export default function CheckInStep({ onBack, onCompleted }: CheckInStepProps) {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
        💳 Check-in & Payment - Coming Soon
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        This step will show today's appointments with payment and check-in functionality.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={onCompleted} className="btn-primary">
          Complete & Reset
        </button>
      </div>
    </div>
  )
}
