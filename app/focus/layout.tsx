import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Focus Mode - CT Studio',
  description: 'Simplified sales workflow',
}

export default function FocusLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {children}
    </div>
  )
}
