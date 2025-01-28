"use client"

import { useState } from "react"
import { processExcel } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [summaries, setSummaries] = useState<Array<{
    customerCode: string;
    totalCODAfterCalculation: number;
    isWhitelisted: boolean;
    clientName: string | null;
  }>>([])
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsProcessing(true)
    setSummaries([])
    setError(null)

    try {
      const formData = new FormData(event.currentTarget)
      const { buffer, summaries, fileName } = await processExcel(formData)
      
      // Download Excel
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSummaries(summaries)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Excel Processor</CardTitle>
          <CardDescription>Upload Excel to process multiple shippers</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="file" name="file" accept=".xlsx" required />
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? <><Loader2 className="mr-2 animate-spin" /> Processing...</> : "Process Excel"}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {summaries.map(summary => (
            <Alert key={summary.customerCode} className="mt-4">
              <AlertTitle>
                {summary.isWhitelisted ? "Whitelisted" : "Processed"} : {summary.customerCode}
              </AlertTitle>
              <AlertDescription>
                {summary.isWhitelisted ? (
                  <p>{summary.clientName} - No calculations applied</p>
                ) : (
                  <p>Total COD: {summary.totalCODAfterCalculation.toFixed(2)} MAD</p>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}