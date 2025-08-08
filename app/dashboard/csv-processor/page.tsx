"use client"

import { useState } from "react"
import { processExcel } from "@/app/actions" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from 'lucide-react'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon } from 'lucide-react'

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsProcessing(true)
    setError(null)
    setProgress(0)
    setProgressMessage("Initialisation...")

    try {
      const formData = new FormData(event.currentTarget)
      if (fromDate && toDate) {
        const adjustedFromDate = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()))
        const adjustedToDate = new Date(
          Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999),
        )

        formData.append("fromDate", adjustedFromDate.toISOString())
        formData.append("toDate", adjustedToDate.toISOString())
      }

      // Start a progress simulation since we can't get real-time progress from server actions
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) {
            const increment = Math.random() * 2 + 0.5 // Random increment between 0.5 and 2.5
            return Math.min(prev + increment, 90)
          }
          return prev
        })
      }, 1000)

      // Update progress message periodically
      const messageInterval = setInterval(() => {
        const messages = [
          "Connexion au système...",
          "Récupération des données de facture...",
          "Traitement des fichiers...",
          "Application des règles métier...",
          "Appels API pour le client 565...",
          "Calcul des frais de transport...",
          "Traitement des montants COD...",
          "Calcul des frais de surpoids...",
          "Finalisation des calculs..."
        ]
        const randomMessage = messages[Math.floor(Math.random() * messages.length)]
        setProgressMessage(randomMessage)
      }, 3000)

      const { buffer, fileName } = await processExcel(formData)

      // Clear intervals and set completion
      clearInterval(progressInterval)
      clearInterval(messageInterval)
      setProgress(100)
      setProgressMessage("Téléchargement en cours...")

      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Reset after a short delay
      setTimeout(() => {
        setProgress(0)
        setProgressMessage("")
      }, 2000)

    } catch (error) {
      setError(error instanceof Error ? error.message : "Une erreur s'est produite...")
      setProgress(0)
      setProgressMessage("")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Processeur Excel</CardTitle>
          <CardDescription>Téléchargez un fichier Excel ou sélectionnez une plage de dates pour traiter plusieurs expéditeurs</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="file-upload" className="text-sm font-medium">
                Télécharger un fichier Excel
              </label>
              <Input id="file-upload" type="file" name="file" accept=".xlsx" />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Ou sélectionnez une plage de dates</label>
              <div className="flex space-x-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !fromDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "PPP") : <span>Date de début</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !toDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "PPP") : <span>Date de fin</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {/* Progress Bar */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Traitement en cours...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
                {progressMessage && (
                  <p className="text-sm text-muted-foreground">{progressMessage}</p>
                )}
              </div>
            )}
            
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 animate-spin" /> Traitement en cours... veuillez patienter
                </>
              ) : (
                "Traiter les données"
              )}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
