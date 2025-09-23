import ExcelJS from 'exceljs'

export interface SanityIssue {
  row: number
  column?: string
  issue: 'missing_value' | 'duplicate' | 'inconsistent_format' | 'outlier' | 'type_mismatch' | 'invalid_value' | 'cross_field_contamination'
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
  invalid_values: number
  cross_field_contamination: number
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
    invalid_values: 0,
    cross_field_contamination: 0,
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

  // Enhanced validation checks for specific data quality issues
  performEnhancedValidation(data, headers, issues, summary)

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

function performEnhancedValidation(
  data: Record<string, any>[],
  headers: string[],
  issues: Record<string, SanityIssue[]>,
  summary: SanitySummary
) {
  data.forEach((row, rowIndex) => {
    headers.forEach(header => {
      const value = String(row[header] || '').trim()
      if (!value) return // Skip empty values (already handled)

      const lowerHeader = header.toLowerCase()
      const actualRow = rowIndex + 2 // +2 for header row and 0-based index

      // Check for invalid values in phone fields
      if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('tel')) {
        if (isInvalidPhoneValue(value)) {
          issues[header].push({
            row: actualRow,
            column: header,
            issue: 'invalid_value',
            value: value,
            details: `Invalid phone value: "${value}" - should contain valid phone number`
          })
          summary.invalid_values++
        }
      }

      // Check for numbers in text fields (notes, comments, description, etc.)
      if (lowerHeader.includes('note') || lowerHeader.includes('comment') ||
          lowerHeader.includes('description') || lowerHeader.includes('remark')) {
        if (isLikelyMisplacedNumber(value)) {
          issues[header].push({
            row: actualRow,
            column: header,
            issue: 'invalid_value',
            value: value,
            details: `Numeric value "${value}" found in text field - may be misplaced data`
          })
          summary.invalid_values++
        }

        // Check for email addresses in notes/comments (might be misplaced)
        if (containsEmail(value)) {
          issues[header].push({
            row: actualRow,
            column: header,
            issue: 'cross_field_contamination',
            value: value,
            details: `Email address found in "${header}" field - may belong in contact field`
          })
          summary.cross_field_contamination++
        }
      }

      // Check for addresses in company/organization fields
      if (lowerHeader.includes('company') || lowerHeader.includes('organization') ||
          lowerHeader.includes('business') || lowerHeader.includes('employer')) {
        if (looksLikeAddress(value)) {
          issues[header].push({
            row: actualRow,
            column: header,
            issue: 'cross_field_contamination',
            value: value,
            details: `Address-like data "${value}" found in company field - should be in address field`
          })
          summary.cross_field_contamination++
        }
      }

      // Check for names in email fields
      if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) {
        if (!isValidEmail(value) && looksLikeName(value)) {
          issues[header].push({
            row: actualRow,
            column: header,
            issue: 'cross_field_contamination',
            value: value,
            details: `Name-like data "${value}" found in email field - should be in name field`
          })
          summary.cross_field_contamination++
        }
      }

      // Check for common placeholder/invalid values
      if (isCommonInvalidValue(value)) {
        issues[header].push({
          row: actualRow,
          column: header,
          issue: 'invalid_value',
          value: value,
          details: `Invalid placeholder value "${value}" - should be removed or replaced with actual data`
        })
        summary.invalid_values++
      }
    })
  })
}

function isInvalidPhoneValue(value: string): boolean {
  const cleaned = value.replace(/[\s\-\(\)\.]/g, '')

  // Common invalid phone values
  const invalidValues = ['n/a', 'na', 'null', 'none', 'nil', 'blank', 'empty', 'tbd', 'unknown']
  if (invalidValues.includes(value.toLowerCase())) return true

  // Check if it's all the same digit repeated
  if (/^(\d)\1+$/.test(cleaned) && cleaned.length > 3) return true

  // Check if it's too short or too long for a phone number
  if (cleaned.length > 0 && (cleaned.length < 7 || cleaned.length > 15)) return true

  // Check if it contains letters (except for valid formats like +1-800-FLOWERS)
  if (/[a-zA-Z]/.test(value) && !value.includes('+')) return true

  return false
}

function isLikelyMisplacedNumber(value: string): boolean {
  // Check if the value is purely numeric and reasonably long
  const numericValue = value.replace(/[\s\-\,\.]/g, '')
  if (/^\d+$/.test(numericValue) && numericValue.length >= 5) {
    return true
  }
  return false
}

function containsEmail(value: string): boolean {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  return emailRegex.test(value)
}

function looksLikeAddress(value: string): boolean {
  // Check if value starts with a number (common for street addresses)
  if (/^\d+\s/.test(value)) return true

  // Check for common address indicators
  const addressIndicators = [
    'street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'lane', 'ln',
    'boulevard', 'blvd', 'circle', 'cir', 'court', 'ct', 'place', 'pl',
    'suite', 'ste', 'apartment', 'apt', 'unit', '#'
  ]

  const lowerValue = value.toLowerCase()
  return addressIndicators.some(indicator => lowerValue.includes(indicator))
}

function isValidEmail(value: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/
  return emailRegex.test(value)
}

function looksLikeName(value: string): boolean {
  // Check if it looks like a person's name (2+ words, no numbers, reasonable length)
  const words = value.split(/\s+/)
  if (words.length < 2) return false

  // Check if all words start with capital letters and contain only letters
  return words.every(word =>
    /^[A-Z][a-z]+$/.test(word) && word.length > 1 && word.length < 20
  )
}

function isCommonInvalidValue(value: string): boolean {
  const lowerValue = value.toLowerCase().trim()
  const invalidValues = [
    'n/a', 'na', 'null', 'none', 'nil', 'blank', 'empty', 'tbd', 'tba',
    'unknown', 'undefined', 'missing', 'pending', 'temp', 'temporary',
    'test', 'example', 'sample', 'placeholder', 'dummy', 'fake',
    'asdf', 'qwerty', 'xxxx', '----', '####', '????',
    'lorem', 'ipsum', 'dolor'
  ]

  return invalidValues.includes(lowerValue) ||
         /^x+$/i.test(lowerValue) ||
         /^-+$/.test(lowerValue) ||
         /^#+$/.test(lowerValue) ||
         /^\?+$/.test(lowerValue)
}