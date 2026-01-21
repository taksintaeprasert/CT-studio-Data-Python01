export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: number
          full_name: string
          phone: string | null
          contact_channel: string | null
          note: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          full_name: string
          phone?: string | null
          contact_channel?: string | null
          note?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          full_name?: string
          phone?: string | null
          contact_channel?: string | null
          note?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      staff: {
        Row: {
          id: number
          staff_name: string
          email: string
          role: 'super_admin' | 'admin' | 'sales' | 'artist' | 'marketer'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          staff_name: string
          email: string
          role: 'super_admin' | 'admin' | 'sales' | 'artist' | 'marketer'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          staff_name?: string
          email?: string
          role?: 'super_admin' | 'admin' | 'sales' | 'artist' | 'marketer'
          is_active?: boolean
          created_at?: string
        }
      }
      products: {
        Row: {
          id: number
          product_code: string
          product_name: string
          category: string | null
          list_price: number
          is_free: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          product_code: string
          product_name: string
          category?: string | null
          list_price?: number
          is_free?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          product_code?: string
          product_name?: string
          category?: string | null
          list_price?: number
          is_free?: boolean
          is_active?: boolean
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: number
          customer_id: number
          sales_id: number | null
          artist_id: number | null
          order_date: string
          appointment_date: string | null
          appointment_time: string | null
          order_status: 'booking' | 'active' | 'done' | 'cancel'
          total_income: number
          deposit: number
          payment_method: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          customer_id: number
          sales_id?: number | null
          artist_id?: number | null
          order_date?: string
          appointment_date?: string | null
          appointment_time?: string | null
          order_status?: 'booking' | 'active' | 'done' | 'cancel'
          total_income?: number
          deposit?: number
          payment_method?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          customer_id?: number
          sales_id?: number | null
          artist_id?: number | null
          order_date?: string
          appointment_date?: string | null
          appointment_time?: string | null
          order_status?: 'booking' | 'active' | 'done' | 'cancel'
          total_income?: number
          deposit?: number
          payment_method?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: number
          order_id: number
          product_id: number
          is_upsell: boolean
          created_at: string
        }
        Insert: {
          id?: number
          order_id: number
          product_id: number
          is_upsell?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          order_id?: number
          product_id?: number
          is_upsell?: boolean
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: number
          order_id: number
          payment_date: string
          amount: number
          payment_method: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: number
          order_id: number
          payment_date?: string
          amount: number
          payment_method?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          order_id?: number
          payment_date?: string
          amount?: number
          payment_method?: string | null
          note?: string | null
          created_at?: string
        }
      }
      chats: {
        Row: {
          id: number
          chat_date: string
          total_chats: number
          created_at: string
        }
        Insert: {
          id?: number
          chat_date: string
          total_chats?: number
          created_at?: string
        }
        Update: {
          id?: number
          chat_date?: string
          total_chats?: number
          created_at?: string
        }
      }
      ads_budget: {
        Row: {
          id: number
          week_start_date: string
          platform: string
          budget: number
          income: number
          created_at: string
        }
        Insert: {
          id?: number
          week_start_date: string
          platform: string
          budget?: number
          income?: number
          created_at?: string
        }
        Update: {
          id?: number
          week_start_date?: string
          platform?: string
          budget?: number
          income?: number
          created_at?: string
        }
      }
      service_photos: {
        Row: {
          id: number
          order_item_id: number
          photo_url: string
          photo_path: string
          photo_type: 'before' | 'after'
          uploaded_by: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: number
          order_item_id: number
          photo_url: string
          photo_path: string
          photo_type?: 'before' | 'after'
          uploaded_by?: number | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          order_item_id?: number
          photo_url?: string
          photo_path?: string
          photo_type?: 'before' | 'after'
          uploaded_by?: number | null
          note?: string | null
          created_at?: string
        }
      }
    }
  }
}

// Helper types
export type Customer = Database['public']['Tables']['customers']['Row']
export type Staff = Database['public']['Tables']['staff']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Chat = Database['public']['Tables']['chats']['Row']
export type AdsBudget = Database['public']['Tables']['ads_budget']['Row']
export type ServicePhoto = Database['public']['Tables']['service_photos']['Row']

// Staff role type
export type StaffRole = 'super_admin' | 'admin' | 'sales' | 'artist' | 'marketer'

// Photo type
export type PhotoType = 'before' | 'after'

// Role-based access configuration
export const ROLE_ACCESS: Record<StaffRole, string[]> = {
  super_admin: ['*'], // All pages
  admin: ['/', '/orders', '/service', '/calendar', '/customers', '/products', '/sales', '/staff'],
  marketer: ['/', '/orders', '/service', '/calendar', '/customers', '/products', '/sales', '/staff'],
  sales: ['/', '/orders', '/service', '/calendar', '/customers', '/products'],
  artist: ['/artist', '/calendar'],
}
