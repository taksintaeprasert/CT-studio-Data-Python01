'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StaffRole, ROLE_ACCESS } from '@/lib/supabase/types'

interface UserInfo {
  id: number
  email: string
  staffName: string
  role: StaffRole
}

interface UserContextType {
  user: UserInfo | null
  loading: boolean
  hasAccess: (path: string) => boolean
  isRole: (...roles: StaffRole[]) => boolean
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchUser = async () => {
    try {
      // Get current auth session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user?.email) {
        setUser(null)
        setLoading(false)
        return
      }

      // Fetch staff info by email
      const { data: staff } = await supabase
        .from('staff')
        .select('id, email, staff_name, role')
        .eq('email', session.user.email)
        .eq('is_active', true)
        .single()

      if (staff) {
        setUser({
          id: staff.id,
          email: staff.email,
          staffName: staff.staff_name,
          role: staff.role as StaffRole,
        })
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Check if user has access to a specific path
  const hasAccess = (path: string): boolean => {
    if (!user) return false

    const allowedPaths = ROLE_ACCESS[user.role]

    // Super admin and marketer have access to everything
    if (allowedPaths.includes('*')) return true

    // Check exact match or prefix match
    return allowedPaths.some(allowed =>
      path === allowed || path.startsWith(allowed + '/')
    )
  }

  // Check if user has one of the specified roles
  const isRole = (...roles: StaffRole[]): boolean => {
    if (!user) return false
    return roles.includes(user.role)
  }

  const refresh = async () => {
    setLoading(true)
    await fetchUser()
  }

  return (
    <UserContext.Provider value={{ user, loading, hasAccess, isRole, refresh }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

// Higher-order component for role-based page protection
export function withRoleAccess<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  allowedRoles: StaffRole[]
) {
  return function WithRoleAccessComponent(props: P) {
    const { user, loading, isRole } = useUser()

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }

    if (!user || !isRole(...allowedRoles)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-2xl font-bold text-red-500 mb-2">Access Denied</div>
          <div className="text-gray-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>
        </div>
      )
    }

    return <WrappedComponent {...props} />
  }
}
