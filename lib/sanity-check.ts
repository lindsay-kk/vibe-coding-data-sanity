import ExcelJS from 'exceljs'

export interface SanityIssue {
  row: number
  column?: string
  issue: 'missing_value' | 'duplicate' | 'inconsistent_format' | 'outlier' | 'type_mismatch'
  value: any
  expected?: string
  details?: string
}

export interface SanitySummary {
  missing_values: number
  duplicates: number
  inconsistent_formats: number
  outliers: number
  type_mismatches: number
  total_rows: number
  total_columns: number
}

export interface SanityReport {
  columns: Record<string, SanityIssue[]>
  summary: SanitySummary
}

export async function analyzeCsvData(csvContent: string): Promise<SanityReport> {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length === 0) {
    throw new Error('Empty CSV file')
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const data: Record<string, any>[] = []

  // Parse CSV data
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    const row: Record<string, any> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return performSanityCheck(data, headers)
}

export async function analyzeExcelData(buffer: Buffer): Promise<SanityReport> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.getWorksheet(1) // Get first worksheet
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file')
  }

  const data: Record<string, any>[] = []
  const headers: string[] = []

  // Get headers from first row
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell, colNumber) => {
    headers.push(String(cell.value || `Column${colNumber}`))
  })

  // Get data from remaining rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber)
    const rowData: Record<string, any> = {}

    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1)
      rowData[header] = cell.value || ''
    })

    // Skip empty rows
    if (Object.values(rowData).some(value => String(value).trim())) {
      data.push(rowData)
    }
  }

  return performSanityCheck(data, headers)
}

export function performSanityCheck(data: Record<string, any>[], headers: string[]): SanityReport {
  const issues: Record<string, SanityIssue[]> = {}
  const summary: SanitySummary = {
    missing_values: 0,
    duplicates: 0,
    inconsistent_formats: 0,
    outliers: 0,
    type_mismatches: 0,
    total_rows: data.length,
    total_columns: headers.length
  }

  // Initialize issues object
  headers.forEach(header => {
    issues[header] = []
  })

  // Check for missing values
  data.forEach((row, rowIndex) => {
    headers.forEach(header => {
      const value = row[header]
      if (value === '' || value === null || value === undefined ||
          (typeof value === 'string' && value.trim() === '')) {
        issues[header].push({
          row: rowIndex + 2, // +2 because of header row and 0-based index
          column: header,
          issue: 'missing_value',
          value: value
        })
        summary.missing_values++
      }
    })
  })

  // Check for duplicates
  const seenRows = new Set<string>()
  data.forEach((row, rowIndex) => {
    const rowString = JSON.stringify(row)
    if (seenRows.has(rowString)) {
      headers.forEach(header => {
        issues[header].push({
          row: rowIndex + 2,
          column: header,
          issue: 'duplicate',
          value: row[header],
          details: 'Duplicate row detected'
        })
      })
      summary.duplicates++
    } else {
      seenRows.add(rowString)
    }
  })

  // Check data types and formats for each column
  headers.forEach(header => {
    const columnValues = data.map(row => row[header]).filter(v => v !== '' && v !== null && v !== undefined)

    if (columnValues.length === 0) return

    // Detect column type based on majority of values
    const detectedType = detectColumnType(columnValues)

    // Check for inconsistent formats
    columnValues.forEach((value, index) => {
      const rowIndex = data.findIndex(row => row[header] === value)

      if (!isValueOfType(value, detectedType)) {
        issues[header].push({
          row: rowIndex + 2,
          column: header,
          issue: 'type_mismatch',
          value: value,
          expected: detectedType,
          details: `Expected ${detectedType}, got ${typeof value}`
        })
        summary.type_mismatches++
      }

      // Check for format inconsistencies within the same type
      if (detectedType === 'date' && !isValidDate(value)) {
        issues[header].push({
          row: rowIndex + 2,
          column: header,
          issue: 'inconsistent_format',
          value: value,
          details: 'Invalid date format'
        })
        summary.inconsistent_formats++
      }

      if (detectedType === 'number' && isNaN(Number(value))) {
        issues[header].push({
          row: rowIndex + 2,
          column: header,
          issue: 'inconsistent_format',
          value: value,
          details: 'Invalid number format'
        })
        summary.inconsistent_formats++
      }
    })

    // Check for outliers in numeric columns
    if (detectedType === 'number') {
      const numericValues = columnValues
        .map(v => Number(v))
        .filter(v => !isNaN(v))

      const outliers = detectOutliers(numericValues)

      outliers.forEach(outlierValue => {
        const rowIndex = data.findIndex(row => Number(row[header]) === outlierValue)
        if (rowIndex !== -1) {
          issues[header].push({
            row: rowIndex + 2,
            column: header,
            issue: 'outlier',
            value: outlierValue,
            details: 'Statistical outlier detected'
          })
          summary.outliers++
        }
      })
    }
  })

  return { columns: issues, summary }
}

function detectColumnType(values: any[]): string {
  const typeScores = {
    number: 0,
    date: 0,
    boolean: 0,
    string: 0
  }

  values.forEach(value => {
    const str = String(value).trim()

    if (!isNaN(Number(str)) && str !== '') {
      typeScores.number++
    } else if (isValidDate(str)) {
      typeScores.date++
    } else if (str.toLowerCase() === 'true' || str.toLowerCase() === 'false' ||
               str === '1' || str === '0' || str.toLowerCase() === 'yes' || str.toLowerCase() === 'no') {
      typeScores.boolean++
    } else {
      typeScores.string++
    }
  })

  return Object.entries(typeScores).reduce((a, b) =>
    typeScores[a[0] as keyof typeof typeScores] > typeScores[b[0] as keyof typeof typeScores] ? a : b
  )[0]
}

function isValueOfType(value: any, type: string): boolean {
  const str = String(value).trim()

  switch (type) {
    case 'number':
      return !isNaN(Number(str)) && str !== ''
    case 'date':
      return isValidDate(str)
    case 'boolean':
      return ['true', 'false', '1', '0', 'yes', 'no'].includes(str.toLowerCase())
    case 'string':
      return true
    default:
      return true
  }
}

function isValidDate(dateString: string): boolean {
  // Common date formats
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // M/D/YYYY
  ]

  if (datePatterns.some(pattern => pattern.test(dateString))) {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }

  return false
}

function detectOutliers(numbers: number[]): number[] {
  if (numbers.length < 4) return []

  const sorted = [...numbers].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  return numbers.filter(num => num < lowerBound || num > upperBound)
}