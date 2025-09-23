import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // This will contain the sheet URL

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 })
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
    )

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Process the sheet directly with OAuth token
    if (state && tokens.access_token) {
      try {
        console.log('🔐 Processing sheet with OAuth token:', state)

        const { supabaseAdmin } = await import('@/lib/supabase')
        const { createServerClient } = await import('@supabase/ssr')
        const { cookies } = await import('next/headers')

        // Try to get the current authenticated user
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
          console.log('❌ No authenticated user found for OAuth callback')
          return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=authentication_required`)
        }

        console.log('✅ Found authenticated user:', user.id)

        // Get the actual sheet title using OAuth token
        const { getGoogleSheetTitle } = await import('@/lib/google-sheets')
        let sheetTitle = 'Google Sheet'
        try {
          sheetTitle = await getGoogleSheetTitle(state, tokens.access_token!)
          console.log('📝 Retrieved sheet title for OAuth:', sheetTitle)
        } catch (titleError) {
          console.log('Could not get sheet title with OAuth, using default')
        }

        // Create file record for Google Sheet
        const { data: fileData, error: fileError } = await supabaseAdmin
          .from('files')
          .insert({
            user_id: user.id,
            filename: 'google_sheet',
            original_filename: sheetTitle,
            file_size: 0,
            google_sheet_url: state
          })
          .select()
          .single()

        if (fileError) {
          console.error('Failed to create file record:', fileError)
          return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=file_creation_failed`)
        }

        // Create report record
        const { data: reportData, error: reportError } = await supabaseAdmin
          .from('reports')
          .insert({
            file_id: fileData.id,
            user_id: user.id,
            status: 'processing',
            google_sheet_url: state,
            document_name: sheetTitle,
            document_type: 'google_sheet'
          })
          .select()
          .single()

        if (reportError) {
          console.error('Failed to create report:', reportError)
          return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=report_creation_failed`)
        }

        const reportId = reportData.id

        // Process the sheet in the background
        const { processGoogleSheet } = await import('@/lib/google-sheets')
        const { generateInsights } = await import('@/lib/gemini')

        // Start processing (don't await - do it in background)
        setImmediate(async () => {
          try {
            console.log('🚀 Background processing started for:', reportId)

            const result = await processGoogleSheet(state, tokens.access_token!)
            const sanityReport = result.sanityReport
            const rawData = result.data || []

            // Store sanity check results
            await supabaseAdmin
              .from('issues')
              .insert({
                report_id: reportId,
                issues_json: sanityReport.columns,
                summary: sanityReport.summary
              })

            // Generate AI insights
            try {
              const insights = await generateInsights(sanityReport, rawData.slice(0, 5))
              await supabaseAdmin
                .from('insights')
                .insert({
                  report_id: reportId,
                  gemini_summary: insights.summary,
                  gemini_recommendations: insights.recommendations,
                  gemini_raw: insights.raw
                })
            } catch (geminiError) {
              console.error('❌ Gemini insights generation failed:', geminiError)
            }

            // Update report status
            await supabaseAdmin
              .from('reports')
              .update({
                status: 'complete',
                completed_at: new Date().toISOString()
              })
              .eq('id', reportId)

            console.log('✅ Background processing completed for:', reportId)

          } catch (processError) {
            console.error('❌ Background processing failed:', processError)
            await supabaseAdmin
              .from('reports')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString()
              })
              .eq('id', reportId)
          }
        })

        // Redirect to report page immediately
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/report/${reportId}`)

      } catch (error) {
        console.error('OAuth processing error:', error)
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=processing_failed`)
      }
    }

    // Fallback if no state
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json({ error: 'OAuth authentication failed' }, { status: 500 })
  }
}