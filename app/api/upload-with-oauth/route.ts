import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Get auth user
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get OAuth token and sheet URL from cookies
    const accessToken = request.cookies.get('google_access_token')?.value
    const sheetUrl = request.cookies.get('pending_sheet_url')?.value

    if (!accessToken || !sheetUrl) {
      return NextResponse.json({
        error: 'Missing OAuth token or sheet URL. Please try the authentication flow again.'
      }, { status: 400 })
    }

    console.log('🔐 Processing authenticated Google Sheet:', sheetUrl)

    // Create report record
    const { data: reportData, error: reportError } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: user.id,
        status: 'processing',
        google_sheet_url: sheetUrl
      })
      .select()
      .single()

    if (reportError) {
      console.error('Failed to create report:', reportError)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    const reportId = reportData.id

    // Trigger background processing with OAuth token
    try {
      const processResponse = await fetch(`${request.nextUrl.origin}/api/process-with-oauth/${reportId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ sheetUrl, accessToken })
      })

      if (!processResponse.ok) {
        throw new Error('Failed to start processing')
      }
    } catch (processError) {
      console.error('Failed to start processing:', processError)
      // Update report status to failed
      await supabaseAdmin
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', reportId)

      return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 })
    }

    // Clear the pending sheet URL cookie
    const response = NextResponse.json({ reportId })
    response.cookies.delete('pending_sheet_url')

    return response

  } catch (error) {
    console.error('Upload with OAuth error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}