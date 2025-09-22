import { google } from 'googleapis'
import type { SanityReport } from './sanity-check'

interface GoogleSheetsConfig {
  serviceAccountEmail: string
  serviceAccountPrivateKey: string
}

export class GoogleSheetsService {
  private auth: any
  private sheets: any

  constructor(config: GoogleSheetsConfig) {
    this.auth = new google.auth.JWT({
      email: config.serviceAccountEmail,
      key: config.serviceAccountPrivateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    this.sheets = google.sheets({ version: 'v4', auth: this.auth })
  }

  extractSpreadsheetId(url: string): string {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      throw new Error('Invalid Google Sheets URL')
    }
    return match[1]
  }

  async getSheetData(sheetUrl: string, range = 'A:Z'): Promise<Record<string, any>[]> {
    try {
      const spreadsheetId = this.extractSpreadsheetId(sheetUrl)

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      })

      const rows = response.data.values
      if (!rows || rows.length === 0) {
        throw new Error('No data found in the sheet')
      }

      const headers = rows[0]
      const data: Record<string, any>[] = []

      for (let i = 1; i < rows.length; i++) {
        const row: Record<string, any> = {}
        headers.forEach((header: string, index: number) => {
          row[header] = rows[i][index] || ''
        })
        data.push(row)
      }

      return data
    } catch (error) {
      console.error('Error fetching sheet data:', error)
      throw new Error('Failed to fetch Google Sheet data')
    }
  }

  async annotateSheet(sheetUrl: string, sanityReport: SanityReport): Promise<void> {
    try {
      const spreadsheetId = this.extractSpreadsheetId(sheetUrl)

      // Get sheet metadata to find the main sheet ID
      const metadata = await this.sheets.spreadsheets.get({
        spreadsheetId,
      })

      const mainSheetId = metadata.data.sheets[0].properties.sheetId

      // Prepare batch update requests
      const requests: any[] = []

      // Get sheet data to map column names to indices
      const sheetData = await this.getSheetData(sheetUrl)
      const headers = Object.keys(sheetData[0] || {})

      // Create column index mapping
      const columnMap: Record<string, number> = {}
      headers.forEach((header, index) => {
        columnMap[header] = index
      })

      // Apply cell formatting for each issue
      Object.entries(sanityReport.columns).forEach(([columnName, issues]: [string, any[]]) => {
        const columnIndex = columnMap[columnName]
        if (columnIndex === undefined) return

        issues.forEach((issue: any) => {
          const cellColor = this.getIssueColor(issue.issue)

          requests.push({
            repeatCell: {
              range: {
                sheetId: mainSheetId,
                startRowIndex: issue.row - 1, // Convert to 0-based index
                endRowIndex: issue.row,
                startColumnIndex: columnIndex,
                endColumnIndex: columnIndex + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: cellColor,
                },
              },
              fields: 'userEnteredFormat.backgroundColor',
            },
          })

          // Add note to cell
          requests.push({
            updateCells: {
              range: {
                sheetId: mainSheetId,
                startRowIndex: issue.row - 1,
                endRowIndex: issue.row,
                startColumnIndex: columnIndex,
                endColumnIndex: columnIndex + 1,
              },
              rows: [
                {
                  values: [
                    {
                      note: `Issue: ${issue.issue}\nValue: ${issue.value}\n${issue.details || ''}`,
                    },
                  ],
                },
              ],
              fields: 'note',
            },
          })
        })
      })

      // Execute batch update
      if (requests.length > 0) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests,
          },
        })
      }

      // Add summary sheet
      await this.addSummarySheet(spreadsheetId, sanityReport)

    } catch (error) {
      console.error('Error annotating sheet:', error)
      throw new Error('Failed to annotate Google Sheet')
    }
  }

  private getIssueColor(issueType: string): { red: number; green: number; blue: number } {
    switch (issueType) {
      case 'missing_value':
        return { red: 1, green: 1, blue: 0 } // Yellow
      case 'duplicate':
        return { red: 1, green: 0, blue: 0 } // Red
      case 'inconsistent_format':
        return { red: 0, green: 0, blue: 1 } // Blue
      case 'outlier':
        return { red: 1, green: 0.65, blue: 0 } // Orange
      case 'type_mismatch':
        return { red: 1, green: 0, blue: 1 } // Magenta
      default:
        return { red: 0.8, green: 0.8, blue: 0.8 } // Light gray
    }
  }

  private async addSummarySheet(spreadsheetId: string, sanityReport: SanityReport): Promise<void> {
    try {
      // First, create the summary sheet
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Data Sanity Report',
                },
              },
            },
          ],
        },
      })

      // Get the new sheet ID
      const metadata = await this.sheets.spreadsheets.get({
        spreadsheetId,
      })

      const summarySheet = metadata.data.sheets.find(
        (sheet: any) => sheet.properties.title === 'Data Sanity Report'
      )

      if (!summarySheet) {
        throw new Error('Failed to create summary sheet')
      }

      const summarySheetId = summarySheet.properties.sheetId

      // Prepare summary data
      const summaryData = [
        ['Data Sanity Check Report'],
        [''],
        ['Summary Statistics:'],
        ['Total Rows', sanityReport.summary.total_rows],
        ['Total Columns', sanityReport.summary.total_columns],
        ['Missing Values', sanityReport.summary.missing_values],
        ['Duplicates', sanityReport.summary.duplicates],
        ['Format Issues', sanityReport.summary.inconsistent_formats],
        ['Outliers', sanityReport.summary.outliers],
        ['Type Mismatches', sanityReport.summary.type_mismatches],
        [''],
        ['Issues by Column:'],
      ]

      // Add column issue details
      Object.entries(sanityReport.columns).forEach(([columnName, issues]: [string, any[]]) => {
        if (issues.length > 0) {
          summaryData.push([`${columnName}: ${issues.length} issues`])
          issues.slice(0, 5).forEach((issue: any) => {
            summaryData.push([`  Row ${issue.row}: ${issue.issue} (${issue.value})`])
          })
          if (issues.length > 5) {
            summaryData.push([`  ... and ${issues.length - 5} more`])
          }
          summaryData.push([''])
        }
      })

      // Write summary data
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Data Sanity Report'!A1:B${summaryData.length}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: summaryData,
        },
      })

      // Format the summary sheet
      const formatRequests = [
        // Make title bold and larger
        {
          repeatCell: {
            range: {
              sheetId: summarySheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                  fontSize: 16,
                },
              },
            },
            fields: 'userEnteredFormat.textFormat',
          },
        },
        // Make section headers bold
        {
          repeatCell: {
            range: {
              sheetId: summarySheetId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat.textFormat',
          },
        },
      ]

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: formatRequests,
        },
      })

    } catch (error) {
      console.error('Error adding summary sheet:', error)
      // Don't throw here - summary sheet is nice to have but not critical
    }
  }
}

export async function createGoogleSheetsService(): Promise<GoogleSheetsService> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error('Google Sheets service account credentials not configured')
  }

  return new GoogleSheetsService({
    serviceAccountEmail,
    serviceAccountPrivateKey,
  })
}

export async function processGoogleSheet(sheetUrl: string, accessToken?: string) {
  const startTime = Date.now()
  console.log(`🚀 Starting Google Sheet processing: ${sheetUrl}`)

  try {
    let rows: any[][] = []

    if (accessToken) {
      console.log('📝 Using OAuth token for private sheet access')
      const fetchStart = Date.now()

      // Use OAuth token to access private sheets
      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: accessToken })

      const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
      const spreadsheetId = extractSpreadsheetId(sheetUrl)

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A:Z', // Get all columns
      })

      rows = response.data.values || []
      console.log(`✅ OAuth fetch completed in ${Date.now() - fetchStart}ms, rows: ${rows.length}`)
    } else {
      // Try to use Google Sheets API with public access first
      try {
        console.log('🌐 Trying Google Sheets API for public sheet')
        const fetchStart = Date.now()

        const spreadsheetId = extractSpreadsheetId(sheetUrl)
        const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:Z?key=${process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY}`

        const response = await fetch(apiUrl, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })

        if (response.ok) {
          const apiData = await response.json()
          rows = apiData.values || []
          console.log(`✅ API fetch completed in ${Date.now() - fetchStart}ms, rows: ${rows.length}`)
        } else {
          throw new Error(`Google Sheets API failed: ${response.status}`)
        }
      } catch (apiError) {
        console.log('⚠️  Google Sheets API failed, trying CSV export fallback')
        const fetchStart = Date.now()

        // Fall back to CSV export (will likely fail for private sheets)
        const csvUrl = convertToCsvUrl(sheetUrl)

        const response = await fetch(csvUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DataSanityBot/1.0)',
            'Accept': 'text/csv,application/csv,text/plain,*/*'
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })

        if (!response.ok) {
          throw new Error('Google Sheet cannot be accessed. Please either:\n1. Make the sheet completely public (Anyone on the internet can view)\n2. Use the OAuth setup to access private sheets\n3. Download as CSV/Excel and use file upload instead')
        }

        const csvContent = await response.text()
        if (!csvContent || csvContent.trim().length === 0) {
          throw new Error('The sheet appears to be empty or contains no readable data.')
        }

        // Parse CSV into rows array
        rows = csvContent.split('\n')
          .filter(line => line.trim())
          .map(line => parseCSVLine(line))

        console.log(`✅ CSV fetch completed in ${Date.now() - fetchStart}ms, rows: ${rows.length}`)
      }
    }

    if (!rows || rows.length === 0) {
      throw new Error('No data found in the sheet')
    }

    console.log(`📊 Processing ${rows.length} rows for sanity check`)
    const processStart = Date.now()

    // Convert directly to data array (skip CSV conversion)
    const headers = rows[0].map(h => String(h || '').trim())
    const data: Record<string, any>[] = []

    for (let i = 1; i < rows.length; i++) {
      const row: Record<string, any> = {}
      headers.forEach((header: string, index: number) => {
        row[header] = rows[i][index] || ''
      })
      if (Object.values(row).some(value => String(value).trim())) {
        data.push(row)
      }
    }

    // Use optimized sanity check function directly on data
    const { performSanityCheck } = await import('./sanity-check')
    const sanityReport = await performSanityCheck(data, headers)

    console.log(`✅ Sanity check completed in ${Date.now() - processStart}ms`)
    console.log(`🎉 Total processing time: ${Date.now() - startTime}ms`)

    return { sanityReport, data }
  } catch (error) {
    console.error(`❌ Google Sheet processing failed after ${Date.now() - startTime}ms:`, error)
    throw error
  }
}

function extractSpreadsheetId(sheetUrl: string): string {
  // Handle various Google Sheets URL formats
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
  ]

  for (const pattern of patterns) {
    const match = sheetUrl.match(pattern)
    if (match) {
      return match[1]
    }
  }

  throw new Error('Invalid Google Sheets URL format. Please use a valid Google Sheets URL.')
}

function convertToCsvUrl(sheetUrl: string): string {
  const spreadsheetId = extractSpreadsheetId(sheetUrl)

  // Convert to CSV export URL
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`
}

function parseCsvToData(csvContent: string): Record<string, any>[] {
  try {
    const lines = csvContent.split('\n').filter(line => line.trim())
    console.log('CSV lines found:', lines.length)

    if (lines.length === 0) {
      throw new Error('CSV content is empty')
    }

    // Simple CSV parsing (handles basic cases)
    const headers = parseCSVLine(lines[0])
    console.log('Headers found:', headers)

    if (headers.length === 0) {
      throw new Error('No headers found in CSV')
    }

    const data: Record<string, any>[] = []

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: Record<string, any> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      if (Object.values(row).some(value => String(value).trim())) {
        data.push(row)
      }
    }

    console.log('Data rows parsed:', data.length)
    return data
  } catch (error) {
    console.error('Error parsing CSV:', error)
    throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Add the last field
  result.push(current.trim())

  return result
}