import { GoogleGenerativeAI } from '@google/generative-ai'
import type { SanityReport } from './sanity-check'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export interface GeminiInsights {
  summary: string
  recommendations: string
  fixSnippets?: string
  raw?: any
}

export async function generateInsights(
  sanityReport: SanityReport,
  sampleData?: Record<string, any>[]
): Promise<GeminiInsights> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = createAnalysisPrompt(sanityReport, sampleData)

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Parse the structured response
    const parsed = parseGeminiResponse(text)

    return {
      summary: parsed.summary,
      recommendations: parsed.recommendations,
      fixSnippets: parsed.fixSnippets,
      raw: {
        prompt,
        fullResponse: text,
        usage: result.response.usageMetadata
      }
    }
  } catch (error) {
    console.error('Gemini API error:', error)
    throw new Error('Failed to generate AI insights')
  }
}

function createAnalysisPrompt(sanityReport: SanityReport, sampleData?: Record<string, any>[]): string {
  const { summary, columns } = sanityReport

  let prompt = `You are a data quality expert. Analyze this dataset sanity check report and provide insights in a structured format.

## Dataset Summary:
- Total Rows: ${summary.total_rows}
- Total Columns: ${summary.total_columns}
- Missing Values: ${summary.missing_values}
- Duplicates: ${summary.duplicates}
- Format Issues: ${summary.inconsistent_formats}
- Outliers: ${summary.outliers}
- Type Mismatches: ${summary.type_mismatches}

## Issues by Column:
`

  Object.entries(columns).forEach(([columnName, issues]) => {
    if (issues.length > 0) {
      prompt += `\n### ${columnName}:\n`
      issues.slice(0, 5).forEach(issue => {
        prompt += `- Row ${issue.row}: ${issue.issue} (Value: "${issue.value}")${issue.details ? ` - ${issue.details}` : ''}\n`
      })
      if (issues.length > 5) {
        prompt += `- ... and ${issues.length - 5} more issues\n`
      }
    }
  })

  if (sampleData && sampleData.length > 0) {
    prompt += `\n## Sample Data (first 3 rows):\n`
    sampleData.slice(0, 3).forEach((row, index) => {
      prompt += `Row ${index + 1}: ${JSON.stringify(row)}\n`
    })
  }

  prompt += `
Please provide your analysis in this exact format:

## SUMMARY
[Write 2-3 sentences explaining the overall data quality state in plain business language]

## RECOMMENDATIONS
[Provide 3-5 specific, actionable recommendations to fix the issues]

## FIX_SNIPPETS
[Provide pseudo-code or SQL-like commands for common fixes, if applicable]

Keep responses concise and focused on business impact. Use non-technical language where possible.`

  return prompt
}

function parseGeminiResponse(text: string): {
  summary: string
  recommendations: string
  fixSnippets?: string
} {
  const sections = {
    summary: '',
    recommendations: '',
    fixSnippets: ''
  }

  const lines = text.split('\n')
  let currentSection = ''

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.includes('## SUMMARY')) {
      currentSection = 'summary'
      continue
    } else if (trimmedLine.includes('## RECOMMENDATIONS')) {
      currentSection = 'recommendations'
      continue
    } else if (trimmedLine.includes('## FIX_SNIPPETS')) {
      currentSection = 'fixSnippets'
      continue
    }

    if (currentSection && trimmedLine) {
      sections[currentSection as keyof typeof sections] += trimmedLine + '\n'
    }
  }

  // Clean up sections
  Object.keys(sections).forEach(key => {
    sections[key as keyof typeof sections] = sections[key as keyof typeof sections].trim()
  })

  return sections
}

export async function generateDatasetSample(
  data: Record<string, any>[],
  maxRows: number = 5
): Promise<Record<string, any>[]> {
  return data.slice(0, maxRows)
}

export async function generateColumnStatistics(
  data: Record<string, any>[],
  columnName: string
): Promise<{
  distinctValues: number
  mostCommon: string[]
  dataType: string
  completeness: number
}> {
  const values = data.map(row => row[columnName]).filter(v => v !== null && v !== undefined && v !== '')
  const distinctValues = new Set(values)

  const counts: Record<string, number> = {}
  values.forEach(value => {
    const str = String(value)
    counts[str] = (counts[str] || 0) + 1
  })

  const mostCommon = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([value]) => value)

  const completeness = (values.length / data.length) * 100

  return {
    distinctValues: distinctValues.size,
    mostCommon,
    dataType: detectDataType(values),
    completeness: Math.round(completeness * 100) / 100
  }
}

function detectDataType(values: any[]): string {
  if (values.length === 0) return 'unknown'

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
    } else if (['true', 'false', '1', '0', 'yes', 'no'].includes(str.toLowerCase())) {
      typeScores.boolean++
    } else {
      typeScores.string++
    }
  })

  return Object.entries(typeScores).reduce((a, b) =>
    typeScores[a[0] as keyof typeof typeScores] > typeScores[b[0] as keyof typeof typeScores] ? a : b
  )[0]
}

function isValidDate(dateString: string): boolean {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
  ]

  if (datePatterns.some(pattern => pattern.test(dateString))) {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }

  return false
}