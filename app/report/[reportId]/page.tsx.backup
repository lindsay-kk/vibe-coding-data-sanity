'use client'

import { useState, useEffect } from 'react'
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
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-600/5 via-gray-500/5 to-gray-700/5"></div>
        <div className="absolute top-20 right-20 w-96 h-96 bg-gray-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
        <div className="text-center relative z-10">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-8">
            <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-white text-lg font-medium">Loading report...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-600/5 via-gray-500/5 to-gray-700/5"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-pulse"></div>
        <div className="max-w-md w-full relative z-10">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
            <p className="text-gray-300 mb-6">{error}</p>
            <Button
              onClick={() => router.push('/')}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Go Back Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-600/5 via-gray-500/5 to-gray-700/5"></div>
        <div className="text-center relative z-10">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-8">
            <FileX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-300 text-lg">No report data found</p>
          </div>
        </div>
      </div>
    )
  }

  const { report, file, issues, insights, annotations } = reportData

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-600/5 via-gray-500/5 to-gray-700/5"></div>
      <div className="absolute top-20 right-20 w-96 h-96 bg-gray-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-gray-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse delay-1000"></div>

      {/* Header */}
      <header className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Data Sanity Report</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">Welcome, {user?.email}</span>
              <button
                onClick={() => router.push('/')}
                className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-white/10"
              >
                New Analysis
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Status Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">
                {file?.original_filename || 'Google Sheet'}
              </h2>
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  report.status === 'complete' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                  report.status === 'processing' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                  'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {report.status === 'processing' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  {report.status === 'complete' && <CheckCircle className="w-4 h-4 mr-2" />}
                  {report.status === 'failed' && <AlertCircle className="w-4 h-4 mr-2" />}
                  {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                </span>
                {polling && <span className="text-sm text-gray-400">Auto-refreshing...</span>}
              </div>
            </div>
            {report.status === 'complete' && annotations && (
              <div className="flex space-x-3">
                {annotations.annotation_type === 'file' && annotations.annotated_file_url && (
                  <Button
                    onClick={downloadAnnotatedFile}
                    className="flex items-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Annotated File
                  </Button>
                )}
                {annotations.annotation_type === 'google_sheet' && annotations.google_sheet_url && (
                  <Button
                    onClick={openGoogleSheet}
                    className="flex items-center bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2 px-4 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Annotated Sheet
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {report.status === 'processing' && (
          <div className="bg-yellow-500/10 backdrop-blur-lg border border-yellow-500/30 rounded-2xl p-6 mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mr-4">
                <RefreshCw className="w-6 h-6 text-white animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-300">Processing Your Data</h3>
                <p className="text-yellow-200">
                  We're analyzing your dataset and generating insights. This usually takes 30-60 seconds.
                </p>
              </div>
            </div>
          </div>
        )}

        {report.status === 'failed' && (
          <div className="bg-red-500/10 backdrop-blur-lg border border-red-500/30 rounded-2xl p-6 mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-300">Processing Failed</h3>
                <p className="text-red-200">
                  There was an error processing your dataset. Please try uploading again or contact support.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        {issues && (
          <div className="grid md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center mr-4">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Dataset Size</p>
                  <p className="text-2xl font-bold text-white">
                    {issues.summary.total_rows.toLocaleString()} × {issues.summary.total_columns}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mr-4">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Missing Values</p>
                  <p className="text-2xl font-bold text-white">{issues.summary.missing_values.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Duplicates</p>
                  <p className="text-2xl font-bold text-white">{issues.summary.duplicates.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Total Issues</p>
                  <p className="text-2xl font-bold text-white">
                    {(issues.summary.missing_values +
                      issues.summary.duplicates +
                      issues.summary.inconsistent_formats +
                      issues.summary.outliers +
                      issues.summary.type_mismatches).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Insights */}
        {insights && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 mb-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mr-3">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white">AI Insights</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Summary</h4>
                <div className="prose prose-sm text-gray-300">
                  {insights.gemini_summary.split('\n').map((line, index) => (
                    <p key={index} className="mb-2">{line}</p>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-white mb-3">Recommendations</h4>
                <div className="prose prose-sm text-gray-300">
                  {insights.gemini_recommendations.split('\n').map((line, index) => (
                    <p key={index} className="mb-2">{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Issues Breakdown */}
        {issues && Object.keys(issues.issues_json).length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-6">Issues by Column</h3>

            <div className="space-y-6">
              {Object.entries(issues.issues_json).map(([columnName, columnIssues]) => {
                if (columnIssues.length === 0) return null

                return (
                  <div key={columnName} className="border-l-4 border-purple-400 pl-4">
                    <h4 className="text-lg font-medium text-white mb-3">
                      {columnName} ({columnIssues.length} issues)
                    </h4>

                    <div className="grid gap-2">
                      {columnIssues.slice(0, 10).map((issue, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-lg rounded-xl border border-white/10">
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${
                              issue.issue === 'missing_value' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                              issue.issue === 'duplicate' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              issue.issue === 'inconsistent_format' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                              issue.issue === 'outlier' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                              'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}>
                              {issue.issue.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-gray-400">Row {issue.row}</span>
                            <span className="text-sm text-gray-300 font-mono">"{issue.value}"</span>
                          </div>
                          {issue.details && (
                            <span className="text-xs text-gray-400">{issue.details}</span>
                          )}
                        </div>
                      ))}

                      {columnIssues.length > 10 && (
                        <div className="text-sm text-gray-400 text-center py-2">
                          ... and {columnIssues.length - 10} more issues
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}