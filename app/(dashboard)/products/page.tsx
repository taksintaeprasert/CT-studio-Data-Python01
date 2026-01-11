'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Product {
  id: number
  product_code: string
  product_name: string
  category: string | null
  list_price: number
  is_free: boolean
  validity_months: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [validityMonths, setValidityMonths] = useState('0')

  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('product_name', { ascending: true })

    setProducts(data || [])
    setLoading(false)
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setProductCode(product.product_code)
      setProductName(product.product_name)
      setCategory(product.category || '')
      setListPrice(product.list_price.toString())
      setIsFree(product.is_free)
      setValidityMonths((product.validity_months || 0).toString())
    } else {
      setEditingProduct(null)
      setProductCode('')
      setProductName('')
      setCategory('')
      setListPrice('')
      setIsFree(false)
      setValidityMonths('0')
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingProduct(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productCode.trim() || !productName.trim()) return

    const data = {
      product_code: productCode.trim(),
      product_name: productName.trim(),
      category: category || null,
      list_price: parseFloat(listPrice) || 0,
      is_free: isFree,
      validity_months: parseInt(validityMonths) || 0,
    }

    if (editingProduct) {
      await supabase
        .from('products')
        .update(data)
        .eq('id', editingProduct.id)
    } else {
      await supabase.from('products').insert(data)
    }

    closeModal()
    fetchProducts()
  }

  const deleteProduct = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?')) return

    await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)

    fetchProducts()
  }

  const filteredProducts = products.filter(p => {
    const matchSearch = p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      p.product_code.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !categoryFilter || p.category === categoryFilter
    return matchSearch && matchCategory
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Stats
  const avgPrice = products.filter(p => !p.is_free).reduce((sum, p) => sum + p.list_price, 0) /
    (products.filter(p => !p.is_free).length || 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">สินค้า/บริการ</h1>
          <p className="text-gray-500 dark:text-gray-400">
            จัดการรายการสินค้าและบริการ ({products.length} รายการ) |
            ราคาเฉลี่ย {formatCurrency(avgPrice)}
          </p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          + เพิ่มสินค้า
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="ค้นหาด้วยชื่อหรือรหัส..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="select w-full sm:w-48"
        >
          <option value="">หมวดหมู่ทั้งหมด</option>
          {categories.map(cat => (
            <option key={cat} value={cat || ''}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อสินค้า/บริการ</th>
                <th>หมวดหมู่</th>
                <th>ราคา</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="font-mono text-sm">{product.product_code}</td>
                  <td className="font-medium">{product.product_name}</td>
                  <td>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded text-sm">
                      {product.category || '-'}
                    </span>
                  </td>
                  <td>
                    {product.is_free ? (
                      <span className="text-green-600 font-medium">ฟรี</span>
                    ) : (
                      formatCurrency(product.list_price)
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(product)}
                        className="text-blue-500 hover:text-blue-600 font-medium"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="text-red-500 hover:text-red-600 font-medium"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-8">
                    ไม่พบรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              {editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  รหัสสินค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="input"
                  placeholder="เช่น TAT-001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อสินค้า/บริการ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input"
                  placeholder="เช่น Tattoo, Piercing, Spa"
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map(cat => (
                    <option key={cat} value={cat || ''} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ราคา (บาท)</label>
                <input
                  type="number"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  className="input"
                  placeholder="0"
                  disabled={isFree}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_free"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="is_free" className="text-sm text-gray-700 dark:text-gray-300">บริการฟรี</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ระยะเวลาสิทธิ์ (เดือน)
                </label>
                <input
                  type="number"
                  value={validityMonths}
                  onChange={(e) => setValidityMonths(e.target.value)}
                  className="input"
                  placeholder="0 = ไม่จำกัด"
                  min="0"
                />
                <p className="text-xs text-gray-400 mt-1">
                  0 = ไม่จำกัด, 3 = FREE, 12 = 50% (1 ปี)
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
