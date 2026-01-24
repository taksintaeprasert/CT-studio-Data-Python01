'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugIncomePage() {
  const [date, setDate] = useState('2026-01-24')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const checkIncome = async () => {
    setLoading(true)
    const diagnostics: any = {}

    try {
      // 1. Get all payments for this date
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .gte('payment_date', date)
        .lte('payment_date', date)
        .order('amount', { ascending: true })

      diagnostics.payments = payments
      diagnostics.paymentsError = paymentsError
      diagnostics.paymentsCount = payments?.length || 0

      // 2. Calculate total income
      const totalIncome = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      diagnostics.totalIncome = totalIncome

      // 3. Separate positive and negative amounts
      const positivePayments = payments?.filter(p => (p.amount || 0) >= 0) || []
      const negativePayments = payments?.filter(p => (p.amount || 0) < 0) || []

      diagnostics.positiveCount = positivePayments.length
      diagnostics.positiveTotal = positivePayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      diagnostics.negativeCount = negativePayments.length
      diagnostics.negativeTotal = negativePayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      diagnostics.negativePayments = negativePayments

      // 4. Get orders created on this date
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_income, deposit, created_at')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)

      diagnostics.orders = orders
      diagnostics.ordersError = ordersError
      diagnostics.ordersCount = orders?.length || 0
      diagnostics.totalBooking = orders?.reduce((sum, o) => sum + (o.total_income || 0), 0) || 0

      setResults(diagnostics)
    } catch (error) {
      diagnostics.criticalError = error
      setResults(diagnostics)
    }

    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="p-8 space-y-6 bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🔍 Income Calculation Debug</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Check why income is showing negative values
        </p>

        <div className="card p-6 mb-6">
          <label className="block font-medium mb-2">Date to check:</label>
          <div className="flex gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input flex-1"
            />
            <button
              onClick={checkIncome}
              disabled={loading}
              className="btn-primary px-6"
            >
              {loading ? '🔄 Checking...' : '🚀 Check Income'}
            </button>
          </div>
        </div>

        {results && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-6 bg-green-50 dark:bg-green-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
                <p className={`text-3xl font-bold ${results.totalIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(results.totalIncome)}
                </p>
                <p className="text-xs text-gray-500 mt-2">{results.paymentsCount} payments</p>
              </div>

              <div className="card p-6 bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Positive Payments</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(results.positiveTotal)}
                </p>
                <p className="text-xs text-gray-500 mt-2">{results.positiveCount} payments</p>
              </div>

              <div className="card p-6 bg-red-50 dark:bg-red-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Negative Payments</p>
                <p className="text-3xl font-bold text-red-600">
                  {formatCurrency(results.negativeTotal)}
                </p>
                <p className="text-xs text-gray-500 mt-2">{results.negativeCount} payments</p>
              </div>
            </div>

            {/* Negative Payments Detail */}
            {results.negativeCount > 0 && (
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-3 text-red-600">⚠️ Negative Payments Found!</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  These payments have negative amounts, which is causing the income to be negative:
                </p>
                <div className="space-y-2">
                  {results.negativePayments.map((payment: any) => (
                    <div key={payment.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-red-600">
                            Payment #{payment.id} (Order #{payment.order_id})
                          </p>
                          <p className="text-sm text-gray-600">
                            Method: {payment.payment_method || 'N/A'}
                          </p>
                          {payment.note && (
                            <p className="text-sm text-gray-600">Note: {payment.note}</p>
                          )}
                        </div>
                        <p className="text-xl font-bold text-red-600">
                          {formatCurrency(payment.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Payments */}
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-3">💰 All Payments on {date}</h2>
              {results.paymentsError ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
                  <p className="text-red-600 font-mono text-sm">
                    ERROR: {JSON.stringify(results.paymentsError)}
                  </p>
                </div>
              ) : (
                <>
                  <p className="mb-4">Found {results.paymentsCount} payment(s)</p>
                  {results.payments && results.payments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="p-2 text-left">ID</th>
                            <th className="p-2 text-left">Order ID</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2 text-left">Method</th>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.payments.map((payment: any) => (
                            <tr key={payment.id} className={`border-t ${payment.amount < 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                              <td className="p-2">{payment.id}</td>
                              <td className="p-2">{payment.order_id}</td>
                              <td className={`p-2 text-right font-bold ${payment.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="p-2">{payment.payment_method || 'N/A'}</td>
                              <td className="p-2">{payment.payment_date}</td>
                              <td className="p-2 text-xs">{payment.note || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No payments found</p>
                  )}
                </>
              )}
            </div>

            {/* Orders Info */}
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-3">📦 Orders Created on {date}</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Orders Count</p>
                  <p className="text-2xl font-bold">{results.ordersCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Booking</p>
                  <p className="text-2xl font-bold text-pink-600">
                    {formatCurrency(results.totalBooking)}
                  </p>
                </div>
              </div>
              {results.orders && results.orders.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="p-2 text-left">Order ID</th>
                        <th className="p-2 text-right">Total Income</th>
                        <th className="p-2 text-right">Deposit</th>
                        <th className="p-2 text-left">Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.orders.map((order: any) => (
                        <tr key={order.id} className="border-t">
                          <td className="p-2">{order.id}</td>
                          <td className="p-2 text-right">{formatCurrency(order.total_income)}</td>
                          <td className="p-2 text-right">{formatCurrency(order.deposit)}</td>
                          <td className="p-2">{new Date(order.created_at).toLocaleString('th-TH')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Raw JSON */}
            <details className="card p-6">
              <summary className="font-bold cursor-pointer">📄 Raw JSON Data</summary>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs mt-4">
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
