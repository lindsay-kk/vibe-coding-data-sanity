import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

// Fixed server-side authentication for subscription API
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user subscription info
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If no subscription exists, create one
    if (subError || !subscription) {
      const { data: newSub, error: createError } = await supabaseAdmin
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_type: 'free',
          reports_limit: 5,
          reports_used: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create subscription:', createError)
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
      }

      // Count all existing reports for storage limit purposes
      const { data: reports, error: reportsError } = await supabaseAdmin
        .from('reports')
        .select('id')
        .eq('user_id', user.id)

      const reportsCount = reports?.length || 0

      // Update the reports_used count
      await supabaseAdmin
        .from('user_subscriptions')
        .update({ reports_used: reportsCount })
        .eq('user_id', user.id)

      return NextResponse.json({
        ...newSub,
        reports_used: reportsCount,
        can_create_report: reportsCount < newSub.reports_limit
      })
    }

    // Count all reports (including failed/processing) for storage limit purposes
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('id')
      .eq('user_id', user.id)

    if (reportsError) {
      console.error('Failed to count reports:', reportsError)
      return NextResponse.json({ error: 'Failed to count reports' }, { status: 500 })
    }

    const reportsCount = reports?.length || 0
    const canCreateReport = subscription.plan_type === 'premium' || reportsCount < subscription.reports_limit

    // Update reports_used if it's out of sync
    if (reportsCount !== subscription.reports_used) {
      await supabaseAdmin
        .from('user_subscriptions')
        .update({ reports_used: reportsCount })
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      ...subscription,
      reports_used: reportsCount,
      can_create_report: canCreateReport
    })

  } catch (error) {
    console.error('Subscription check error:', error)
    return NextResponse.json({
      error: 'Failed to check subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}