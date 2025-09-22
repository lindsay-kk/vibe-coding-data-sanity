import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateInsights } from '@/lib/gemini'
import { processGoogleSheet } from '@/lib/google-sheets'
import { performSanityCheck } from '@/lib/sanity-check'

export async function POST(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = await params
    const { sheetUrl, accessToken } = await request.json()

    console.log('🔐 Starting OAuth-authenticated processing for report:', reportId)

    // Get report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (report.status !== 'processing') {
      return NextResponse.json({ error: 'Report is not in processing state' }, { status: 400 })
    }

    // Process Google Sheet with OAuth token
    console.log('🚀 Processing Google Sheet with OAuth token:', sheetUrl)
    const sheetStartTime = Date.now()

    const result = await processGoogleSheet(sheetUrl, accessToken)
    const sanityReport = result.sanityReport
    const rawData = result.data || []

    console.log(`✅ Google Sheet processed successfully in ${Date.now() - sheetStartTime}ms, rows: ${rawData.length}`)

    // Store sanity check results
    const { data: issuesData, error: issuesError } = await supabaseAdmin
      .from('issues')
      .insert({
        report_id: reportId,
        issues_json: sanityReport.columns,
        summary: sanityReport.summary
      })
      .select()
      .single()

    if (issuesError) {
      console.error('Failed to store issues:', issuesError)
      throw new Error('Failed to store sanity check results')
    }

    // Generate AI insights
    try {
      console.log('🧠 Generating AI insights...')
      const insightsStartTime = Date.now()
      const insights = await generateInsights(sanityReport, rawData.slice(0, 5))

      await supabaseAdmin
        .from('insights')
        .insert({
          report_id: reportId,
          gemini_summary: insights.summary,
          gemini_recommendations: insights.recommendations,
          gemini_raw: insights.raw
        })
      console.log(`✅ AI insights generated in ${Date.now() - insightsStartTime}ms`)
    } catch (geminiError) {
      console.error('❌ Gemini insights generation failed:', geminiError)
      // Continue without insights - don't fail the entire process
    }

    // Update report status
    await supabaseAdmin
      .from('reports')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString()
      })
      .eq('id', reportId)

    console.log('✅ OAuth-authenticated processing completed for report:', reportId)

    return NextResponse.json({
      success: true,
      message: 'OAuth processing completed successfully',
      reportId: reportId
    })

  } catch (error) {
    console.error('❌ OAuth processing error:', error)

    // Update report status to failed
    try {
      await supabaseAdmin
        .from('reports')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', (await params).reportId)
    } catch (updateError) {
      console.error('Failed to update report status:', updateError)
    }

    return NextResponse.json({
      error: 'OAuth processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}