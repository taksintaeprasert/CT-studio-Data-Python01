'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'
import { useLanguage } from '@/lib/language-context'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement, Filler)

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
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
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
              category
            ),
            orders (
              order_status
            )
          `)
          .gte('appointment_date', startDate)
          .lte('appointment_date', endDate)
          .not('appointment_date', 'is', null)

        // Apply product filter
        if (selectedProduct) {
          query = query.eq('product_id', parseInt(selectedProduct))
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
            total_sales: parseFloat(item.item_price) || 0,
          }))

        // Apply category filter on client side
        if (selectedCategory) {
          processedData = processedData.filter((item: SalesAnalytics) =>
            item.category === selectedCategory
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
  }, [startDate, endDate, selectedProduct, selectedCategory, keyword])

  // Calculate totals
  const totalQuantity = dailySummary.reduce((sum, item) => sum + item.quantity, 0)
  const totalSales = dailySummary.reduce((sum, item) => sum + item.total_sales, 0)

  // Chart data
  const dailyChartData = {
    labels: dailySummary.map(d => d.date),
    datasets: [
      {
        label: 'ยอดขาย (฿)',
        data: dailySummary.map(d => d.total_sales),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const quantityChartData = {
    labels: dailySummary.map(d => d.date),
    datasets: [
      {
        label: 'จำนวนสินค้า',
        data: dailySummary.map(d => d.quantity),
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ช่วงวันที่
              </label>
              <DateRangeFilter onDateChange={handleDateChange} />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                หมวดหมู่
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">ทั้งหมด (All Categories)</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                สินค้า
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">ทั้งหมด (All Products)</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_code} - {product.product_name}
                  </option>
                ))}
              </select>
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

        {/* Charts */}
        {!loading && dailySummary.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                ยอดขายรายวัน (Daily Sales)
              </h3>
              <div style={{ height: '300px' }}>
                <Line data={dailyChartData} options={chartOptions} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                จำนวนสินค้ารายวัน (Daily Quantity)
              </h3>
              <div style={{ height: '300px' }}>
                <Bar data={quantityChartData} options={chartOptions} />
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
