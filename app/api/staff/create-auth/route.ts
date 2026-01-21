import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint requires SUPABASE_SERVICE_ROLE_KEY to create auth users
// Only accessible by super_admin

export async function POST(req: NextRequest) {
  try {
    const { staffId, password } = await req.json()

    // Validate input
    if (!staffId || !password) {
      return NextResponse.json(
        { error: 'staffId and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Create Supabase Admin client (with service role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get staff info
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .single()

    if (staffError || !staff) {
      return NextResponse.json(
        { error: 'Staff not found' },
        { status: 404 }
      )
    }

    // Check if staff already has auth account
    if (staff.auth_user_id) {
      return NextResponse.json(
        { error: 'Staff already has an auth account' },
        { status: 400 }
      )
    }

    // Check if email already exists in auth.users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some(u => u.email === staff.email)

    if (emailExists) {
      return NextResponse.json(
        { error: 'Email already exists in auth system' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: staff.email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        staff_name: staff.staff_name,
        role: staff.role,
      },
    })

    if (authError || !authUser.user) {
      console.error('Auth creation error:', authError)
      return NextResponse.json(
        { error: `Failed to create auth user: ${authError?.message}` },
        { status: 500 }
      )
    }

    // Link auth user to staff record
    const { error: updateError } = await supabaseAdmin
      .from('staff')
      .update({ auth_user_id: authUser.user.id })
      .eq('id', staffId)

    if (updateError) {
      console.error('Update error:', updateError)
      // Rollback: Delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { error: 'Failed to link auth user to staff' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Auth account created successfully',
      staff: {
        id: staff.id,
        staff_name: staff.staff_name,
        email: staff.email,
        role: staff.role,
        auth_user_id: authUser.user.id,
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
