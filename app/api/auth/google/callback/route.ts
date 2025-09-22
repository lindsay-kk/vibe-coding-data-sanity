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

        // For OAuth flow, we'll create a guest session since user session may be lost during redirect
        // In a production app, you'd want to handle this more securely
        const { supabaseAdmin } = await import('@/lib/supabase')

        // Create a proper UUID for guest user (temporary solution)
        const { randomUUID } = require('crypto')
        const guestUserId = randomUUID()
        console.log('📝 Creating guest session for OAuth processing:', guestUserId)

        // Create a temporary user first, then create the report
        console.log('📝 Creating temporary user for OAuth processing...')

        // First, create a user in the base auth.users table using admin
        let actualUserId = guestUserId
        try {
          const tempUserEmail = `oauth-guest-${Date.now()}@temp.local`
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: tempUserEmail,
            password: 'temp-password-' + Date.now(),
            user_id: guestUserId,
            email_confirm: true
          })

          if (authError) {
            console.error('Failed to create auth user:', authError)
          } else {
            actualUserId = authUser.user?.id || guestUserId
            console.log('✅ Created temp auth user:', actualUserId)
          }
        } catch (authError) {
          console.error('Auth user creation error:', authError)
        }

        // Now create the report with the actual auth user ID
        const { data: reportData, error: reportError } = await supabaseAdmin
          .from('reports')
          .insert({
            user_id: actualUserId,
            status: 'processing',
            google_sheet_url: state
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