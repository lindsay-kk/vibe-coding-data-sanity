import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

// Fixed server-side authentication for reports API
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

    // Get user's reports with file info
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select(`
        id,
        document_name,
        document_type,
        status,
        google_sheet_url,
        created_at,
        completed_at,
        files (
          original_filename
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50) // Limit to last 50 reports

    if (reportsError) {
      console.error('Failed to fetch reports:', reportsError)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    // Format the reports data
    const formattedReports = reports?.map(report => {
      // Get the original filename from the files relation
      const originalFilename = report.files?.original_filename

      // Determine the display name
      let displayName = 'Unnamed Document'
      if (report.document_name) {
        displayName = report.document_name
      } else if (originalFilename) {
        displayName = originalFilename
      } else if (report.google_sheet_url) {
        displayName = extractNameFromUrl(report.google_sheet_url) || 'Google Sheet'
      }

      // Determine file type
      const fileType = report.document_type || (report.google_sheet_url ? 'google_sheet' : 'csv')

      return {
        id: report.id,
        name: displayName,
        type: fileType,
        originalFilename: originalFilename,
        status: report.status,
        createdAt: report.created_at,
        completedAt: report.completed_at,
        isAccessible: report.status === 'complete'
      }
    }) || []

    return NextResponse.json({
      reports: formattedReports,
      total: formattedReports.length
    })

  } catch (error) {
    console.error('Reports fetch error:', error)
    return NextResponse.json({
      error: 'Failed to fetch reports',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function extractNameFromUrl(url: string | null): string | null {
  if (!url) return null

  try {
    if (url.includes('docs.google.com/spreadsheets')) {
      // Try to extract title from Google Sheets URL or use a default name
      return 'Google Sheet'
    }

    // For other URLs, try to extract filename
    const urlParts = url.split('/')
    const filename = urlParts[urlParts.length - 1]
    return filename.split('?')[0] || null
  } catch {
    return null
  }
}