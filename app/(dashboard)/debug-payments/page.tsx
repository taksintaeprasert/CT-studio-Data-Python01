'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugPaymentsPage() {
  const [orderId, setOrderId] = useState('182')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const runDiagnostics = async () => {
    setLoading(true)
    const diagnostics: any = {}

    try {
      // 1. Check payments table structure
      const { data: columns, error: colError } = await supabase
        .rpc('get_table_columns', { table_name: 'payments' })
        .catch(() => ({ data: null, error: 'RPC not available' }))

      diagnostics.columns = columns || 'Unable to fetch'
      diagnostics.columnsError = colError

      // 2. Get order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', parseInt(orderId))
        .single()

      diagnostics.order = order
      diagnostics.orderError = orderError

      // 3. Get payments - simple query
      const { data: paymentsSimple, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', parseInt(orderId))

      diagnostics.paymentsSimple = paymentsSimple
      diagnostics.paymentsError = paymentsError

      // 4. Get order with nested payments (like frontend)
      const { data: orderWithPayments, error: nestedError } = await supabase
        .from('orders')
        .select(`
          *,
          payments(*)
        `)
        .eq('id', parseInt(orderId))
        .single()

      diagnostics.orderWithPayments = orderWithPayments
      diagnostics.nestedError = nestedError

      // 5. Try to insert a test payment
      const testAmount = 0.01
      const { data: insertTest, error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: parseInt(orderId),
          amount: testAmount,
          payment_method: 'TEST',
          credit_card_fee: 0,
          net_amount: testAmount,
          note: 'DEBUG TEST - DELETE ME',
          payment_date: new Date().toISOString().split('T')[0],
        })
        .select()

      diagnostics.insertTest = insertTest
      diagnostics.insertError = insertError

      // 6. Check RLS policies
      const { data: user } = await supabase.auth.getUser()
      diagnostics.currentUser = user

      setResults(diagnostics)
    } catch (error) {
      diagnostics.criticalError = error
      setResults(diagnostics)
    }

    setLoading(false)
  }

  return (
    <div className="p-8 space-y-6 bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🔍 Payment System Diagnostics</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Debug tool to check payment system issues
        </p>

        <div className="card p-6 mb-6">
          <label className="block font-medium mb-2">Order ID to check:</label>
          <div className="flex gap-3">
            <input
              type="number"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="input flex-1"
              placeholder="Enter Order ID"
            />
            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="btn-primary px-6"
            >
              {loading ? '🔄 Running...' : '🚀 Run Diagnostics'}
            </button>
          </div>
        </div>

        {results && (
          <div className="space-y-4">
            {/* Order Info */}
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-3">📦 Order #{orderId}</h2>
              {results.orderError ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
                  <p className="text-red-600 font-mono text-sm">
                    ERROR: {JSON.stringify(results.orderError)}
                  </p>
                </div>
              ) : (
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(results.order, null, 2)}
                </pre>
              )}
            </div>

            {/* Payments - Simple Query */}
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-3">💰 Payments (Simple Query)</h2>
              {results.paymentsError ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
                  <p className="text-red-600 font-mono text-sm">
                    ERROR: {JSON.stringify(results.paymentsError)}
                  </p>
                </div>
              ) : (
                <>
                  <p className="mb-2">Found {results.paymentsSimple?.length || 0} payment(s)</p>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs">
                    {JSON.stringify(results.paymentsSimple, null, 2)}
                  </pre>
                </>
              )}
            </div>

            {/* Nested Query */}
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-3">🔗 Order with Nested Payments</h2>
              {results.nestedError ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
                  <p className="text-red-600 font-mono text-sm">
                    ERROR: {JSON.stringify(results.nestedError)}
                  </p>
                </div>
              ) : (
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(results.orderWithPayments, null, 2)}
                </pre>
              )}
            </div>

            {/* Insert Test */}
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-3">✏️ Insert Test</h2>
              {results.insertError ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
                  <p className="text-red-600 font-mono text-sm mb-2">
                    <strong>INSERT FAILED!</strong>
                  </p>
                  <p className="text-red-600 font-mono text-xs">
                    {JSON.stringify(results.insertError, null, 2)}
                  </p>
                  <p className="text-sm mt-3 text-red-700">
                    This is the problem! Payments cannot be inserted.
                    Check: columns exist, RLS policies, user permissions.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-800">
                  <p className="text-green-600 font-semibold mb-2">✅ Insert SUCCESS!</p>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs">
                    {JSON.stringify(results.insertTest, null, 2)}
                  </pre>
                  <p className="text-sm mt-3 text-green-700">
                    Payment insert works! The issue might be in the UI refresh logic.
                  </p>
                </div>
              )}
            </div>

            {/* Current User */}
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-3">👤 Current User</h2>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs">
                {JSON.stringify(results.currentUser, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
