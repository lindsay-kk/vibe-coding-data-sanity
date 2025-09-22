'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function ProcessSheetPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Processing authenticated Google Sheet...')

  useEffect(() => {
    const processSheet = async () => {
      try {
        // Call the upload API with OAuth token available in cookies
        const response = await fetch('/api/upload-with-oauth', {
          method: 'POST',
          credentials: 'include' // Include cookies
        })

        if (response.ok) {
          const { reportId } = await response.json()
          router.push(`/report/${reportId}`)
        } else {
          const errorData = await response.json()
          setStatus(`Error: ${errorData.error || 'Failed to process sheet'}`)
        }
      } catch (error) {
        console.error('Error processing sheet:', error)
        setStatus('Error: Failed to process authenticated sheet')
      }
    }

    processSheet()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Google Sheet</h1>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  )
}