import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Submit satisfaction rating
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const body = await request.json()

    const {
      artist_id,
      service_category,
      service_other,
      pain_level,
      artist_service_quality,
      result_satisfaction,
      front_desk_service,
      chat_response_quality,
    } = body

    // Validate required fields
    if (!artist_id || !service_category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Insert satisfaction rating
    const { data, error } = await supabase
      .from('customer_satisfaction')
      .insert({
        artist_id,
        service_category,
        service_other: service_category === 'Other' ? service_other : null,
        pain_level,
        artist_service_quality,
        result_satisfaction,
        front_desk_service,
        chat_response_quality,
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting satisfaction rating:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET - Fetch satisfaction ratings with filters
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const artistId = searchParams.get('artist_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const category = searchParams.get('category')

    let query = supabase
      .from('customer_satisfaction')
      .select(`
        *,
        artist:staff!customer_satisfaction_artist_id_fkey(id, staff_name)
      `)

    // Apply filters
    if (artistId) {
      query = query.eq('artist_id', parseInt(artistId))
    }

    if (startDate) {
      query = query.gte('submitted_at', `${startDate}T00:00:00`)
    }

    if (endDate) {
      query = query.lte('submitted_at', `${endDate}T23:59:59`)
    }

    if (category && category !== 'All') {
      query = query.eq('service_category', category)
    }

    query = query.order('submitted_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching satisfaction ratings:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
