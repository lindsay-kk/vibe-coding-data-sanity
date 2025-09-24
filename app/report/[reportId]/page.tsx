'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/auth'
import {
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  Users,
  FileX,
  Zap,
  Blend,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { ThemeSwitcher } from '@/components/theme-switcher'
import type { User } from '@supabase/supabase-js'

interface ReportData {
  report: {
    id: string
    status: 'processing' | 'complete' | 'failed'
    created_at: string
    completed_at?: string
    google_sheet_url?: string
  }
  file: {
    id: string
    filename: string
    original_filename: string
    file_size: number
    google_sheet_url?: string
  } | null
  issues: {
    id: string
    issues_json: Record<string, any[]>
    summary: {
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
    created_at: string
  } | null
  insights: {
    id: string
    gemini_summary: string
    gemini_recommendations: string
    gemini_raw?: any
    created_at: string
  } | null
  annotations: {
    id: string
    annotated_file_url?: string
    google_sheet_url?: string
    annotation_type: 'file' | 'google_sheet'
    created_at: string
  } | null
}

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.reportId as string

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [polling, setPolling] = useState(false)
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set())

  const supabase = createClient()

  // Check auth and fetch initial data
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
        return
      }
      setUser(user)
      await fetchReport()
    }
    checkAuth()
  }, [reportId])

  // Poll for updates when processing
  useEffect(() => {
    if (reportData?.report.status === 'processing') {
      setPolling(true)
      const interval = setInterval(fetchReport, 3000) // Poll every 3 seconds
      return () => {
        clearInterval(interval)
        setPolling(false)
      }
    } else {
      setPolling(false)
    }
  }, [reportData?.report.status])

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/report/${reportId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Report not found')
        } else if (response.status === 401) {
          router.push('/login')
          return
        } else if (response.status === 403) {
          // Check if it's an OAuth required error
          try {
            const errorData = await response.json()
            if (errorData.requiresOAuth) {
              // Trigger OAuth redirect
              const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
              if (clientId) {
                const oauth2Url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
                oauth2Url.searchParams.append('client_id', clientId)
                oauth2Url.searchParams.append('redirect_uri', `${window.location.origin}/api/auth/google/callback`)
                oauth2Url.searchParams.append('response_type', 'code')
                oauth2Url.searchParams.append('scope', 'https://www.googleapis.com/auth/spreadsheets.readonly')
                oauth2Url.searchParams.append('access_type', 'offline')
                oauth2Url.searchParams.append('state', `${reportId}|${errorData.sheetUrl}`)

                window.location.href = oauth2Url.toString()
                return
              }
            }
          } catch (parseError) {
            console.error('Error parsing OAuth response:', parseError)
          }
          setError('Authentication required for this Google Sheet')
        } else {
          setError('Failed to fetch report')
        }
        return
      }

      const data: ReportData = await response.json()
      setReportData(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching report:', err)
      setError('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const downloadAnnotatedFile = () => {
    if (reportData?.annotations?.annotated_file_url) {
      window.open(reportData.annotations.annotated_file_url, '_blank')
    }
  }

  const openGoogleSheet = () => {
    if (reportData?.annotations?.google_sheet_url) {
      window.open(reportData.annotations.google_sheet_url, '_blank')
    }
  }

  const toggleColumnExpansion = useCallback((columnName: string) => {
    setExpandedColumns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(columnName)) {
        newSet.delete(columnName)
      } else {
        newSet.add(columnName)
      }
      return newSet
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center p-8">
            <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
            <p className="text-foreground text-lg font-medium">Loading report...</p>
          </CardContent>
        </Card>
        <ThemeSwitcher />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center p-6">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Report Error</h2>
            <p className="text-muted-foreground mb-6 text-center">{error}</p>
            <Button onClick={() => router.push('/')}>
              Go Back Home
            </Button>
          </CardContent>
        </Card>
        <ThemeSwitcher />
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center p-8">
            <FileX className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground text-lg">No report data found</p>
          </CardContent>
        </Card>
        <ThemeSwitcher />
      </div>
    )
  }

  const { report, file, issues, insights, annotations } = reportData

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-black">
                <CheckCircle className="size-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold">Data Sanity Report</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button
                onClick={() => router.push('/')}
                variant="ghost"
                size="sm"
              >
                New Analysis
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl p-6">
        {/* Status Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {file?.original_filename || 'Google Sheet'}
                </h2>
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    report.status === 'complete' ? 'bg-green-500/20 text-green-600 border border-green-500/30' :
                    report.status === 'processing' ? 'bg-yellow-500/20 text-yellow-600 border border-yellow-500/30' :
                    'bg-red-500/20 text-red-600 border border-red-500/30'
                  }`}>
                    {report.status === 'processing' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {report.status === 'complete' && <CheckCircle className="w-4 h-4 mr-2" />}
                    {report.status === 'failed' && <AlertCircle className="w-4 h-4 mr-2" />}
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </span>
                  {polling && <span className="text-sm text-muted-foreground">Auto-refreshing...</span>}
                </div>
              </div>
              {report.status === 'complete' && annotations && (
                <div className="flex space-x-3">
                  {annotations.annotation_type === 'file' && annotations.annotated_file_url && (
                    <Button
                      onClick={downloadAnnotatedFile}
                      className="flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Annotated File
                    </Button>
                  )}
                  {annotations.annotation_type === 'google_sheet' && annotations.google_sheet_url && (
                    <Button
                      onClick={openGoogleSheet}
                      className="flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Annotated Sheet
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {report.status === 'processing' && (
          <Card className="border-yellow-500/30 bg-yellow-500/5 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mr-4">
                  <RefreshCw className="w-6 h-6 text-yellow-600 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Processing Your Data</h3>
                  <p className="text-muted-foreground">
                    We're analyzing your dataset and generating insights. This usually takes 30-60 seconds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {report.status === 'failed' && (
          <Card className="border-red-500/30 bg-red-500/5 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Processing Failed</h3>
                  <p className="text-muted-foreground">
                    There was an error processing your dataset. Please try uploading again or contact support.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Statistics */}
        {issues && (
          <div className="grid md:grid-cols-4 gap-6 mb-6">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="size-6 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-2">Dataset Size</h4>
                <p className="text-2xl font-bold text-foreground">
                  {issues.summary.total_rows.toLocaleString()} × {issues.summary.total_columns}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="size-10 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="size-6 text-yellow-600" />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-2">Missing Values</h4>
                <p className="text-2xl font-bold text-foreground">{issues.summary.missing_values.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="size-10 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Blend className="size-6 text-red-600" />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-2">Duplicates</h4>
                <p className="text-2xl font-bold text-foreground">{issues.summary.duplicates.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <div className="cursor-pointer">
                      <div className="size-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="size-6 text-green-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-foreground mb-2">Total Issues</h4>
                      <p className="text-2xl font-bold text-foreground">
                        {(issues.summary.missing_values +
                          issues.summary.duplicates +
                          issues.summary.inconsistent_formats +
                          issues.summary.outliers +
                          issues.summary.type_mismatches +
                          (issues.summary.invalid_values || 0) +
                          (issues.summary.cross_field_contamination || 0)).toLocaleString()}
                      </p>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Issue Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Missing Values</span>
                          <span className="text-sm font-medium">{issues.summary.missing_values.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Duplicates</span>
                          <span className="text-sm font-medium">{issues.summary.duplicates.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Invalid Values</span>
                          <span className="text-sm font-medium">{(issues.summary.invalid_values || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Cross-field Issues</span>
                          <span className="text-sm font-medium">{(issues.summary.cross_field_contamination || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Type Mismatches</span>
                          <span className="text-sm font-medium">{issues.summary.type_mismatches.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Inconsistent Formats</span>
                          <span className="text-sm font-medium">{issues.summary.inconsistent_formats.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Outliers</span>
                          <span className="text-sm font-medium">{issues.summary.outliers.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Insights */}
        {insights && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-purple-100">
                  <Zap className="size-5 text-purple-600" />
                </div>
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-medium text-foreground mb-3">Summary</h4>
                  <div className="prose prose-sm text-muted-foreground">
                    {insights.gemini_summary.split('\n').map((line, index) => (
                      <p key={index} className="mb-2">{line}</p>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-foreground mb-3">Recommendations</h4>
                  <div className="prose prose-sm text-muted-foreground">
                    {insights.gemini_recommendations.split('\n').map((line, index) => (
                      <p key={index} className="mb-2" dangerouslySetInnerHTML={{
                        __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Issues Breakdown */}
        {issues && Object.keys(issues.issues_json).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Issues by Column</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(issues.issues_json).map(([columnName, columnIssues]) => {
                  if (columnIssues.length === 0) return null

                  const isExpanded = expandedColumns.has(columnName)
                  const displayedIssues = isExpanded ? columnIssues : columnIssues.slice(0, 10)
                  const hasMoreIssues = columnIssues.length > 10

                  return (
                    <div key={columnName} className="border-l-4 border-primary pl-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-medium text-foreground">
                          {columnName} ({columnIssues.length} issues)
                        </h4>
                        {hasMoreIssues && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleColumnExpansion(columnName)}
                            className="flex items-center gap-2"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Show All ({columnIssues.length})
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-2">
                        {displayedIssues.map((issue, index) => (
                          <div key={`${columnName}-${index}-${issue.row}`} className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                            <div className="flex items-center space-x-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${
                                issue.issue === 'missing_value' ? 'bg-yellow-500/20 text-yellow-600 border border-yellow-500/30' :
                                issue.issue === 'duplicate' ? 'bg-red-500/20 text-red-600 border border-red-500/30' :
                                issue.issue === 'inconsistent_format' ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30' :
                                issue.issue === 'outlier' ? 'bg-orange-500/20 text-orange-600 border border-orange-500/30' :
                                issue.issue === 'type_mismatch' ? 'bg-indigo-500/20 text-indigo-600 border border-indigo-500/30' :
                                issue.issue === 'invalid_value' ? 'bg-orange-500/20 text-orange-600 border border-orange-500/30' :
                                issue.issue === 'cross_field_contamination' ? 'bg-purple-500/20 text-purple-600 border border-purple-500/30' :
                                'bg-gray-500/20 text-gray-600 border border-gray-500/30'
                              }`}>
                                {issue.issue.replace('_', ' ')}
                              </span>
                              <span className="text-sm text-muted-foreground">Row {issue.row}</span>
                              <span className="text-sm text-foreground font-mono">"{issue.value}"</span>
                            </div>
                            {issue.details && (
                              <span className="text-xs text-muted-foreground">{issue.details}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Theme Switcher */}
      <ThemeSwitcher />
    </div>
  )
}