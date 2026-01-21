import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Get list of staff members without auth accounts
// Only accessible by super_admin/admin

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Get all active staff without auth_user_id
    const { data: staffList, error } = await supabase
      .from('staff')
      .select('id, staff_name, email, role, is_active, auth_user_id, created_at')
      .is('auth_user_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch staff list' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: staffList?.length || 0,
      staff: staffList || [],
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
