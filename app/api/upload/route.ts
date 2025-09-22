import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type')

    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // Validate file type
      const allowedTypes = [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ]

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({
          error: 'Invalid file type. Please upload CSV or Excel files only.'
        }, { status: 400 })
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({
          error: 'File too large. Please upload files under 10MB.'
        }, { status: 400 })
      }

      // Generate unique filename
      const timestamp = Date.now()
      const filename = `${user.id}/${timestamp}_${file.name}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('datasets')
        .upload(filename, file, {
          contentType: file.type,
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json({
          error: 'Upload failed',
          details: uploadError.message,
          hint: 'Check if storage buckets are created in Supabase'
        }, { status: 500 })
      }

      // Create file record
      const { data: fileData, error: fileError } = await supabaseAdmin
        .from('files')
        .insert({
          user_id: user.id,
          filename: filename,
          original_filename: file.name,
          file_size: file.size,
          storage_path: uploadData.path
        })
        .select()
        .single()

      if (fileError) {
        console.error('File record error:', fileError)
        return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
      }

      // Create report record
      const { data: reportData, error: reportError } = await supabaseAdmin
        .from('reports')
        .insert({
          file_id: fileData.id,
          user_id: user.id,
          status: 'processing'
        })
        .select()
        .single()

      if (reportError) {
        console.error('Report record error:', reportError)
        return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 })
      }

      // Trigger processing (don't await to avoid blocking the response)
      fetch(`${process.env.NEXTAUTH_URL}/api/process/${reportData.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }).catch(error => {
        console.error('Processing trigger error:', error)
      })

      return NextResponse.json({
        reportId: reportData.id,
        message: 'File uploaded successfully and processing started'
      })

    } else {
      // Handle Google Sheets URL
      const { googleSheetUrl } = await request.json()

      if (!googleSheetUrl) {
        return NextResponse.json({ error: 'No Google Sheet URL provided' }, { status: 400 })
      }

      // Validate Google Sheets URL format
      const sheetsRegex = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/
      if (!sheetsRegex.test(googleSheetUrl)) {
        return NextResponse.json({
          error: 'Invalid Google Sheets URL format'
        }, { status: 400 })
      }

      // Create file record for Google Sheet
      const { data: fileData, error: fileError } = await supabaseAdmin
        .from('files')
        .insert({
          user_id: user.id,
          filename: 'google_sheet',
          original_filename: 'Google Sheet',
          file_size: 0,
          google_sheet_url: googleSheetUrl
        })
        .select()
        .single()

      if (fileError) {
        console.error('File record error:', fileError)
        return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
      }

      // Create report record
      const { data: reportData, error: reportError } = await supabaseAdmin
        .from('reports')
        .insert({
          file_id: fileData.id,
          user_id: user.id,
          status: 'processing',
          google_sheet_url: googleSheetUrl
        })
        .select()
        .single()

      if (reportError) {
        console.error('Report record error:', reportError)
        return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 })
      }

      // Test if the sheet is accessible without OAuth
      try {
        console.log('🧪 Testing sheet access:', googleSheetUrl)
        const { processGoogleSheet } = await import('@/lib/google-sheets')

        // Quick test with a timeout - just try to fetch headers
        const testPromise = processGoogleSheet(googleSheetUrl)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        )

        await Promise.race([testPromise, timeoutPromise])

        console.log('✅ Sheet is publicly accessible, starting normal processing')

        // If successful, use normal processing
        fetch(`${process.env.NEXTAUTH_URL}/api/process/${reportData.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }).catch(error => {
          console.error('Processing trigger error:', error)
        })

        return NextResponse.json({
          reportId: reportData.id,
          message: 'Google Sheet processing started'
        })

      } catch (testError) {
        console.log('🔐 Sheet requires authentication, triggering OAuth')

        // If access fails, require OAuth
        return NextResponse.json({
          error: 'oauth_required',
          message: 'This Google Sheet requires authentication. Please use OAuth to access private sheets.',
          sheetUrl: googleSheetUrl,
          requiresOAuth: true
        }, { status: 403 })
      }
    }

  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}