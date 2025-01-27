"use client"

import { useState } from "react"
import { processCSV } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalCODAfterCalculation, setTotalCODAfterCalculation] = useState<number | null>(null)
  const [customerCode, setCustomerCode] = useState<string | null>(null)
  const [isWhitelisted, setIsWhitelisted] = useState(false)
  const [clientName, setClientName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsProcessing(true)
    setTotalCODAfterCalculation(null)
    setCustomerCode(null)
    setIsWhitelisted(false)
    setClientName(null)
    setError(null)

    const formData = new FormData(event.currentTarget)

    try {
      const { buffer, totalCODAfterCalculation, customerCode, isWhitelisted, clientName, fileName } = await processCSV(formData)
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setTotalCODAfterCalculation(totalCODAfterCalculation)
      setCustomerCode(customerCode)
      setIsWhitelisted(isWhitelisted)
      setClientName(clientName)
    } catch (error) {
      console.error("Error processing file:", error)
      setError(error instanceof Error ? error.message : "An error occurred while processing the file")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>CSV Processor</CardTitle>
          <CardDescription>Upload your CSV file to process and add new columns</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="file" name="file" accept=".csv" required />
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Process CSV"
              )}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {customerCode && (
            <Alert className="mt-4">
              <AlertTitle>Processing Complete</AlertTitle>
              <AlertDescription className="space-y-2">
                {isWhitelisted ? (
                  <>
                    <p>Customer Code: {customerCode}</p>
                    <p>Client Name: {clientName}</p>
                    <p className="font-medium text-blue-600">This is a whitelisted client - No calculations applied</p>
                  </>
                ) : (
                  <>
                    <p>Customer Code: {customerCode}</p>
                    <p>Total COD After Calculation: {totalCODAfterCalculation?.toFixed(2)} MAD</p>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

