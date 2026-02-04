'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'
import { useLanguage } from '@/lib/language-context'

interface Product {
  id: number
  product_code: string
  product_name: string
  category: string | null
}

interface SalesAnalytics {
  date: string
  product_id: number
  product_code: string
  product_name: string
  category: string | null
  quantity: number
  total_sales: number
}

interface DailySummary {
  date: string
  quantity: number
  total_sales: number
}

export default function AnalyticsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [analyticsData, setAnalyticsData] = useState<SalesAnalytics[]>([])
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')

  const { t } = useLanguage()
  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  // Initialize date range (last 30 days by default)
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)

    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    setStartDate(formatDate(start))
    setEndDate(formatDate(end))
  }, [])

  // Fetch products and categories
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_code, product_name, category')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('product_name', { ascending: true })

      if (!error && data) {
        setProducts(data)

        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(data.map((p: any) => p.category).filter(Boolean))
        ).sort() as string[]

        setCategories(uniqueCategories)
      }
    }

    fetchProducts()
  }, [])

  // Fetch analytics data
  useEffect(() => {
    if (!startDate || !endDate) return

    const fetchAnalytics = async () => {
      setLoading(true)

      try {
        // Build query
        let query = supabase
          .from('order_items')
          .select(`
            appointment_date,
            item_price,
            product_id,
            products (
              id,
              product_code,
              product_name,
              category,
              list_price
            ),
            orders (
              order_status
            )
          `)
          .gte('appointment_date', startDate)
          .lte('appointment_date', endDate)
          .not('appointment_date', 'is', null)

        // Apply product filter
        if (selectedProducts.length > 0) {
          const productIds = selectedProducts.map(p => parseInt(p))
          query = query.in('product_id', productIds)
        }

        const { data, error } = await query

        if (error) {
          console.error('Error fetching analytics:', error)
          setLoading(false)
          return
        }

        if (!data) {
          setAnalyticsData([])
          setDailySummary([])
          setLoading(false)
          return
        }

        // Process data
        let processedData = data
          .filter((item: any) => item.products && item.appointment_date)
          .map((item: any) => ({
            date: item.appointment_date,
            product_id: item.products.id,
            product_code: item.products.product_code,
            product_name: item.products.product_name,
            category: item.products.category,
            quantity: 1,
            // Use item_price if available, fallback to list_price for old data
            total_sales: parseFloat(item.item_price) || parseFloat(item.products.list_price) || 0,
          }))

        // Apply category filter on client side
        if (selectedCategories.length > 0) {
          processedData = processedData.filter((item: SalesAnalytics) =>
            item.category && selectedCategories.includes(item.category)
          )
        }

        // Apply keyword filter on client side
        if (keyword.trim()) {
          const lowerKeyword = keyword.toLowerCase().trim()
          processedData = processedData.filter((item: SalesAnalytics) =>
            item.product_code.toLowerCase().includes(lowerKeyword) ||
            item.product_name.toLowerCase().includes(lowerKeyword)
          )
        }

        // Group by date and product
        const groupedByDateProduct = processedData.reduce((acc: any, item: SalesAnalytics) => {
          const key = `${item.date}_${item.product_id}`
          if (!acc[key]) {
            acc[key] = { ...item }
          } else {
            acc[key].quantity += item.quantity
            acc[key].total_sales += item.total_sales
          }
          return acc
        }, {})

        const analytics = Object.values(groupedByDateProduct) as SalesAnalytics[]
        analytics.sort((a, b) => a.date.localeCompare(b.date))
        setAnalyticsData(analytics)

        // Group by date for daily summary
        const groupedByDate = processedData.reduce((acc: any, item: SalesAnalytics) => {
          if (!acc[item.date]) {
            acc[item.date] = {
              date: item.date,
              quantity: 0,
              total_sales: 0,
            }
          }
          acc[item.date].quantity += item.quantity
          acc[item.date].total_sales += item.total_sales
          return acc
        }, {})

        const daily = Object.values(groupedByDate) as DailySummary[]
        daily.sort((a, b) => a.date.localeCompare(b.date))
        setDailySummary(daily)

      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [startDate, endDate, selectedProducts, selectedCategories, keyword])

  // Calculate totals
  const totalQuantity = dailySummary.reduce((sum, item) => sum + item.quantity, 0)
  const totalSales = dailySummary.reduce((sum, item) => sum + item.total_sales, 0)

  // Group data by category
  const categoryData = analyticsData.reduce((acc: any, item: SalesAnalytics) => {
    const category = item.category || 'ไม่มีหมวดหมู่'
    if (!acc[category]) {
      acc[category] = {
        category,
        booking: 0,
        income: 0,
        products: {},
      }
    }
    acc[category].booking += item.quantity
    acc[category].income += item.total_sales

    // Group by product within category
    const productKey = `${item.product_code} - ${item.product_name}`
    if (!acc[category].products[productKey]) {
      acc[category].products[productKey] = {
        booking: 0,
        income: 0,
      }
    }
    acc[category].products[productKey].booking += item.quantity
    acc[category].products[productKey].income += item.total_sales

    return acc
  }, {})

  const categoryList = Object.values(categoryData).sort((a: any, b: any) =>
    b.income - a.income
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          📊 Data Analytics - วิเคราะห์ยอดขาย
        </h1>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            🔍 ตัวกรอง (Filters)
          </h2>

          <div className="grid grid-cols-1 gap-4 mb-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ช่วงวันที่
              </label>
              <DateRangeFilter onDateChange={handleDateChange} />
            </div>

            {/* Category Filter - Multi Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                หมวดหมู่ (เลือกได้หลายอัน)
              </label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-48 overflow-y-auto bg-white dark:bg-gray-700">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCategories.length === 0}
                      onChange={() => setSelectedCategories([])}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                      ทั้งหมด (All Categories)
                    </span>
                  </label>
                  {categories.map((cat) => (
                    <label key={cat} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories([...selectedCategories, cat])
                          } else {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              {selectedCategories.length > 0 && (
                <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                  เลือกแล้ว {selectedCategories.length} หมวดหมู่
                </div>
              )}
            </div>

            {/* Product Filter - Multi Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                สินค้า (เลือกได้หลายอัน)
              </label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-48 overflow-y-auto bg-white dark:bg-gray-700">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === 0}
                      onChange={() => setSelectedProducts([])}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                      ทั้งหมด (All Products)
                    </span>
                  </label>
                  {products.map((product) => (
                    <label key={product.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(String(product.id))}
                        onChange={(e) => {
                          const productId = String(product.id)
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, productId])
                          } else {
                            setSelectedProducts(selectedProducts.filter(p => p !== productId))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {product.product_code} - {product.product_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {selectedProducts.length > 0 && (
                <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                  เลือกแล้ว {selectedProducts.length} สินค้า
                </div>
              )}
            </div>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ค้นหาด้วย Keyword (รหัสสินค้าหรือชื่อ)
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="เช่น LIP, BROW, 7900..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              จำนวนสินค้าทั้งหมด
            </h3>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {totalQuantity.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total Quantity
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              ยอดขายรวม
            </h3>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              ฿{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total Sales
            </p>
          </div>
        </div>

        {/* Category and Product Breakdown */}
        {!loading && analyticsData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              📊 สรุปยอด Booking / Income ตามหมวดหมู่และสินค้า
            </h2>

            <div className="space-y-6">
              {categoryList.map((cat: any, catIndex: number) => (
                <div key={catIndex} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Category Header */}
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-white">
                        {cat.category}
                      </h3>
                      <div className="flex gap-8 text-white">
                        <div className="text-right">
                          <div className="text-sm opacity-90">Booking</div>
                          <div className="text-2xl font-bold">{cat.booking.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm opacity-90">Income</div>
                          <div className="text-2xl font-bold">
                            ฿{cat.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Products in Category */}
                  <div className="bg-white dark:bg-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            สินค้า
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Booking (จำนวน)
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Income (ยอดขาย)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {Object.entries(cat.products)
                          .sort((a: any, b: any) => b[1].income - a[1].income)
                          .map(([productName, productData]: [string, any], prodIndex: number) => (
                            <tr key={prodIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {productName}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600 dark:text-blue-400">
                                {productData.booking.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-semibold text-green-600 dark:text-green-400">
                                ฿{productData.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Grand Total */}
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-lg px-6 py-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">
                    รวมทั้งหมด (Grand Total)
                  </h3>
                  <div className="flex gap-8 text-white">
                    <div className="text-right">
                      <div className="text-sm opacity-90">Total Booking</div>
                      <div className="text-2xl font-bold">{totalQuantity.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-90">Total Income</div>
                      <div className="text-2xl font-bold">
                        ฿{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              📋 รายละเอียดยอดขาย (Sales Details)
            </h2>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                กำลังโหลดข้อมูล...
              </div>
            ) : analyticsData.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                ไม่พบข้อมูล
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      วันที่
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      รหัสสินค้า
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ชื่อสินค้า
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      หมวดหมู่
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      จำนวน
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ยอดขาย (฿)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {analyticsData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.product_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.product_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {item.category || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600 dark:text-green-400">
                        ฿{item.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">
                      รวมทั้งหมด:
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">
                      {totalQuantity}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-green-600 dark:text-green-400">
                      ฿{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
