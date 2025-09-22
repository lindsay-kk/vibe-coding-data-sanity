import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = await params

    // Set up Supabase client with user context
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

    // For OAuth reports, allow access without user authentication
    // Try to get the report first to see if it exists
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select(`
        *,
        files (*),
        issues (*),
        insights (*),
        annotations (*)
      `)
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // If the report has a google_sheet_url, it's an OAuth report - allow access
    // If it has a file, check user authentication
    if (!report.google_sheet_url) {
      // Check authentication for file uploads
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user owns this report
      if (report.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Structure the response according to PRD requirements
    const response = {
      report: {
        id: report.id,
        status: report.status,
        created_at: report.created_at,
        completed_at: report.completed_at,
        google_sheet_url: report.google_sheet_url
      },
      file: report.files ? {
        id: report.files.id,
        filename: report.files.filename,
        original_filename: report.files.original_filename,
        file_size: report.files.file_size,
        google_sheet_url: report.files.google_sheet_url
      } : null,
      issues: report.issues.length > 0 ? {
        id: report.issues[0].id,
        issues_json: report.issues[0].issues_json,
        summary: report.issues[0].summary,
        created_at: report.issues[0].created_at
      } : null,
      insights: report.insights.length > 0 ? {
        id: report.insights[0].id,
        gemini_summary: report.insights[0].gemini_summary,
        gemini_recommendations: report.insights[0].gemini_recommendations,
        gemini_raw: report.insights[0].gemini_raw,
        created_at: report.insights[0].created_at
      } : null,
      annotations: report.annotations.length > 0 ? {
        id: report.annotations[0].id,
        annotated_file_url: report.annotations[0].annotated_file_url,
        google_sheet_url: report.annotations[0].google_sheet_url,
        annotation_type: report.annotations[0].annotation_type,
        created_at: report.annotations[0].created_at
      } : null
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Optional: Add polling endpoint for real-time status updates
export async function HEAD(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = await params

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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new NextResponse(null, { status: 401 })
    }

    // Quick status check
    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .select('status, completed_at')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (error || !report) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Report-Status': report.status,
        'X-Completed-At': report.completed_at || '',
      }
    })

  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}