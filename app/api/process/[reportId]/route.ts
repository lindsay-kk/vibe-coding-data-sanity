import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { analyzeCsvData, analyzeExcelData } from '@/lib/sanity-check'
import { generateInsights } from '@/lib/gemini'
import { annotateExcelFile, annotateCsvFile } from '@/lib/annotation'

export async function POST(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = await params

    // Get report and file information
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select(`
        *,
        files (*)
      `)
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (report.status !== 'processing') {
      return NextResponse.json({ error: 'Report is not in processing state' }, { status: 400 })
    }

    let sanityReport
    let rawData: Record<string, any>[] = []

    if (report.google_sheet_url) {
      // Handle Google Sheets processing
      try {
        console.log('🚀 Processing Google Sheet:', report.google_sheet_url)
        const sheetStartTime = Date.now()
        const result = await processGoogleSheet(report.google_sheet_url)
        sanityReport = result.sanityReport
        rawData = result.data || []
        console.log(`✅ Google Sheet processed successfully in ${Date.now() - sheetStartTime}ms, rows: ${rawData.length}`)
      } catch (error) {
        console.error('Google Sheets processing error:', error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // If it's an access error, update the report status to indicate OAuth is needed
        if (errorMessage.includes('cannot be accessed') || errorMessage.includes('Access denied') || errorMessage.includes('permissions')) {
          // Update report status to indicate OAuth is needed
          await supabaseAdmin
            .from('reports')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', reportId)

          // Return a specific error that the frontend can handle
          return NextResponse.json({
            error: 'oauth_required',
            message: 'This Google Sheet requires authentication. Please use OAuth to access private sheets.',
            sheetUrl: report.google_sheet_url,
            requiresOAuth: true
          }, { status: 403 })
        }

        // For other errors, fail normally
        throw new Error(`Google Sheets processing failed: ${errorMessage}`)
      }
    } else if (report.files.storage_path) {
      // Handle file processing
      const result = await processFile(report.files.storage_path, report.files.original_filename)
      sanityReport = result.sanityReport
      rawData = result.rawData
    } else {
      throw new Error('No data source found for processing')
    }

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

    // Generate annotated files
    let annotatedFileUrl = null
    let googleSheetAnnotated = false

    if (report.files && report.files.storage_path) {
      annotatedFileUrl = await generateAnnotatedFile(
        report.files.storage_path,
        report.files.original_filename,
        sanityReport,
        reportId
      )
    } else if (report.google_sheet_url) {
      // Skip Google Sheet annotation for faster processing
      // This can be very slow for large sheets and requires service account credentials
      console.log('⏭️  Skipping Google Sheet annotation for faster processing')
      googleSheetAnnotated = false
    }

    // Update report status
    await supabaseAdmin
      .from('reports')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString()
      })
      .eq('id', reportId)

    // Store annotation info
    if (annotatedFileUrl) {
      await supabaseAdmin
        .from('annotations')
        .insert({
          report_id: reportId,
          annotated_file_url: annotatedFileUrl,
          annotation_type: 'file'
        })
    } else if (googleSheetAnnotated) {
      await supabaseAdmin
        .from('annotations')
        .insert({
          report_id: reportId,
          google_sheet_url: report.google_sheet_url,
          annotation_type: 'google_sheet'
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Processing completed successfully',
      reportId: reportId,
      annotatedFileUrl,
      googleSheetAnnotated
    })

  } catch (error) {
    console.error('Processing error:', error)

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
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function processFile(storagePath: string, originalFilename: string) {
  // Download file from Supabase Storage
  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from('datasets')
    .download(storagePath)

  if (downloadError || !fileData) {
    throw new Error('Failed to download file for processing')
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())

  // Determine file type and process accordingly
  const isExcel = originalFilename.endsWith('.xlsx') || originalFilename.endsWith('.xls')
  const isCsv = originalFilename.endsWith('.csv')

  let sanityReport
  let rawData: Record<string, any>[] = []

  if (isExcel) {
    sanityReport = await analyzeExcelData(buffer)
    // Extract raw data for insights (simplified extraction)
    rawData = await extractExcelData(buffer)
  } else if (isCsv) {
    const csvContent = buffer.toString('utf-8')
    sanityReport = await analyzeCsvData(csvContent)
    rawData = parseCsvToArray(csvContent)
  } else {
    throw new Error('Unsupported file type')
  }

  return { sanityReport, rawData }
}

async function processGoogleSheet(sheetUrl: string) {
  const { processGoogleSheet: processSheet } = await import('@/lib/google-sheets')
  return await processSheet(sheetUrl)
}

async function generateAnnotatedFile(
  storagePath: string,
  originalFilename: string,
  sanityReport: any,
  reportId: string
): Promise<string> {
  // Download original file
  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from('datasets')
    .download(storagePath)

  if (downloadError || !fileData) {
    throw new Error('Failed to download file for annotation')
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const isExcel = originalFilename.endsWith('.xlsx') || originalFilename.endsWith('.xls')

  let annotatedBuffer: Buffer
  let annotatedFilename: string

  if (isExcel) {
    annotatedBuffer = await annotateExcelFile(buffer, sanityReport)
    annotatedFilename = `${reportId}/annotated_${originalFilename}`
  } else {
    // For CSV files, convert to Excel for better annotation support
    const csvContent = buffer.toString('utf-8')
    const { annotatedCsv } = await annotateCsvFile(csvContent, sanityReport)
    annotatedBuffer = Buffer.from(annotatedCsv, 'utf-8')
    annotatedFilename = `${reportId}/annotated_${originalFilename.replace('.csv', '.xlsx')}`
  }

  // Upload annotated file
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('annotated-files')
    .upload(annotatedFilename, annotatedBuffer, {
      contentType: isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
      upsert: true
    })

  if (uploadError) {
    console.error('Failed to upload annotated file:', uploadError)
    throw new Error('Failed to upload annotated file')
  }

  // Generate signed URL for download
  const { data: signedUrlData } = await supabaseAdmin.storage
    .from('annotated-files')
    .createSignedUrl(annotatedFilename, 3600 * 24) // 24 hours

  return signedUrlData?.signedUrl || uploadData.path
}

async function extractExcelData(buffer: Buffer): Promise<Record<string, any>[]> {
  // This is a simplified version - reuse logic from sanity-check.ts
  const ExcelJS = require('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) return []

  const data: Record<string, any>[] = []
  const headers: string[] = []

  // Get headers
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell: any, colNumber: number) => {
    headers.push(String(cell.value || `Column${colNumber}`))
  })

  // Get data
  for (let rowNumber = 2; rowNumber <= Math.min(worksheet.rowCount, 100); rowNumber++) {
    const row = worksheet.getRow(rowNumber)
    const rowData: Record<string, any> = {}

    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1)
      rowData[header] = cell.value || ''
    })

    if (Object.values(rowData).some(value => String(value).trim())) {
      data.push(rowData)
    }
  }

  return data
}

function parseCsvToArray(csvContent: string): Record<string, any>[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const data: Record<string, any>[] = []

  for (let i = 1; i < Math.min(lines.length, 100); i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    const row: Record<string, any> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return data
}
