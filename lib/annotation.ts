import ExcelJS from 'exceljs'
import type { SanityReport } from './sanity-check'

export interface AnnotationOptions {
  missingValueColor: string
  duplicateColor: string
  formatIssueColor: string
  outlierColor: string
  typeErrorColor: string
}

const DEFAULT_COLORS: AnnotationOptions = {
  missingValueColor: 'FFFFFF00', // Yellow
  duplicateColor: 'FFFF0000',   // Red
  formatIssueColor: 'FF0000FF', // Blue
  outlierColor: 'FFFFA500',     // Orange
  typeErrorColor: 'FFFF00FF'    // Magenta
}

export async function annotateExcelFile(
  originalBuffer: Buffer,
  sanityReport: SanityReport,
  options: AnnotationOptions = DEFAULT_COLORS
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(originalBuffer)

  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) {
    throw new Error('No worksheet found')
  }

  // Get headers for column mapping
  const headers: string[] = []
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell, colNumber) => {
    headers.push(String(cell.value || `Column${colNumber}`))
  })

  // Create a map of column names to column numbers
  const columnMap: Record<string, number> = {}
  headers.forEach((header, index) => {
    columnMap[header] = index + 1
  })

  // Apply annotations for each issue
  Object.entries(sanityReport.columns).forEach(([columnName, issues]) => {
    const colNumber = columnMap[columnName]
    if (!colNumber) return

    issues.forEach(issue => {
      const cell = worksheet.getCell(issue.row, colNumber)

      // Determine color based on issue type
      let fillColor: string
      switch (issue.issue) {
        case 'missing_value':
          fillColor = options.missingValueColor
          break
        case 'duplicate':
          fillColor = options.duplicateColor
          break
        case 'inconsistent_format':
          fillColor = options.formatIssueColor
          break
        case 'outlier':
          fillColor = options.outlierColor
          break
        case 'type_mismatch':
          fillColor = options.typeErrorColor
          break
        default:
          fillColor = options.formatIssueColor
      }

      // Apply background color
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor }
      }

      // Add comment with issue details
      const commentText = `Issue: ${issue.issue}\nValue: ${issue.value}\n${issue.details || ''}`
      cell.note = commentText
    })
  })

  // Add a summary sheet
  const summarySheet = workbook.addWorksheet('Data Sanity Report')

  // Summary statistics
  summarySheet.getCell('A1').value = 'Data Sanity Check Report'
  summarySheet.getCell('A1').font = { bold: true, size: 16 }

  summarySheet.getCell('A3').value = 'Summary Statistics:'
  summarySheet.getCell('A3').font = { bold: true }

  const summaryData = [
    ['Total Rows', sanityReport.summary.total_rows],
    ['Total Columns', sanityReport.summary.total_columns],
    ['Missing Values', sanityReport.summary.missing_values],
    ['Duplicates', sanityReport.summary.duplicates],
    ['Format Issues', sanityReport.summary.inconsistent_formats],
    ['Outliers', sanityReport.summary.outliers],
    ['Type Mismatches', sanityReport.summary.type_mismatches]
  ]

  summaryData.forEach(([label, value], index) => {
    summarySheet.getCell(`A${4 + index}`).value = label
    summarySheet.getCell(`B${4 + index}`).value = value
  })

  // Color legend
  summarySheet.getCell('A12').value = 'Color Legend:'
  summarySheet.getCell('A12').font = { bold: true }

  const legendData = [
    ['Missing Values', options.missingValueColor],
    ['Duplicates', options.duplicateColor],
    ['Format Issues', options.formatIssueColor],
    ['Outliers', options.outlierColor],
    ['Type Errors', options.typeErrorColor]
  ]

  legendData.forEach(([label, color], index) => {
    const labelCell = summarySheet.getCell(`A${13 + index}`)
    const colorCell = summarySheet.getCell(`B${13 + index}`)

    labelCell.value = label
    colorCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: color }
    }
    colorCell.value = '     ' // Add spaces for visibility
  })

  // Issues breakdown by column
  summarySheet.getCell('A19').value = 'Issues by Column:'
  summarySheet.getCell('A19').font = { bold: true }

  let currentRow = 20
  Object.entries(sanityReport.columns).forEach(([columnName, issues]) => {
    if (issues.length > 0) {
      summarySheet.getCell(`A${currentRow}`).value = `${columnName}: ${issues.length} issues`

      // Show first few issues
      issues.slice(0, 5).forEach((issue, index) => {
        summarySheet.getCell(`B${currentRow + index + 1}`).value =
          `Row ${issue.row}: ${issue.issue} (${issue.value})`
      })

      if (issues.length > 5) {
        summarySheet.getCell(`B${currentRow + 6}`).value = `... and ${issues.length - 5} more`
      }

      currentRow += Math.min(issues.length, 5) + 2
    }
  })

  // Auto-fit columns
  summarySheet.columns.forEach(column => {
    column.width = 25
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function annotateCsvFile(
  csvContent: string,
  sanityReport: SanityReport,
  options: AnnotationOptions = DEFAULT_COLORS
): Promise<{ annotatedCsv: string; issuesCsv: string }> {
  const lines = csvContent.split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

  // Create issues CSV
  const issuesData: string[] = ['Row,Column,Issue Type,Value,Details']

  Object.entries(sanityReport.columns).forEach(([columnName, issues]) => {
    issues.forEach(issue => {
      const row = [
        issue.row.toString(),
        columnName,
        issue.issue,
        `"${issue.value}"`,
        `"${issue.details || ''}"`
      ].join(',')
      issuesData.push(row)
    })
  })

  const issuesCsv = issuesData.join('\n')

  // For CSV, we can't add visual annotations, so we'll add columns indicating issues
  const annotatedLines: string[] = []

  // Create new header with issue indicator columns
  const newHeaders = [...headers]
  headers.forEach(header => {
    newHeaders.push(`${header}_ISSUES`)
  })
  annotatedLines.push(newHeaders.join(','))

  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue

    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    const newRow = [...values]

    // Add issue indicators for each column
    headers.forEach(header => {
      const columnIssues = sanityReport.columns[header] || []
      const rowIssues = columnIssues.filter(issue => issue.row === i + 1)

      if (rowIssues.length > 0) {
        const issueTypes = rowIssues.map(issue => issue.issue).join(';')
        newRow.push(`"${issueTypes}"`)
      } else {
        newRow.push('""')
      }
    })

    annotatedLines.push(newRow.join(','))
  }

  return {
    annotatedCsv: annotatedLines.join('\n'),
    issuesCsv
  }
}

export function createIssuesSummaryTable(sanityReport: SanityReport): {
  headers: string[]
  rows: string[][]
} {
  const headers = ['Column', 'Issue Type', 'Count', 'Sample Values']
  const rows: string[][] = []

  Object.entries(sanityReport.columns).forEach(([columnName, issues]) => {
    const issueGroups: Record<string, any[]> = {}

    issues.forEach(issue => {
      if (!issueGroups[issue.issue]) {
        issueGroups[issue.issue] = []
      }
      issueGroups[issue.issue].push(issue.value)
    })

    Object.entries(issueGroups).forEach(([issueType, values]) => {
      const uniqueValues = [...new Set(values)]
      const sampleValues = uniqueValues.slice(0, 3).join(', ')

      rows.push([
        columnName,
        issueType.replace('_', ' '),
        values.length.toString(),
        sampleValues
      ])
    })
  })

  return { headers, rows }
}