import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sheetUrl = searchParams.get('url')

  if (!sheetUrl) {
    return NextResponse.json({ error: 'No sheet URL provided' }, { status: 400 })
  }

  try {
    // Extract spreadsheet ID
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid Google Sheets URL format' }, { status: 400 })
    }

    const spreadsheetId = match[1]
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`

    console.log('Testing CSV URL:', csvUrl)

    const response = await fetch(csvUrl)

    const result = {
      csvUrl,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      contentLength: response.headers.get('content-length'),
      contentType: response.headers.get('content-type'),
    }

    if (response.ok) {
      const content = await response.text()
      result.contentPreview = content.substring(0, 500)
      result.totalLength = content.length
    } else {
      result.errorBody = await response.text()
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}