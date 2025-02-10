"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { fetchHubs, fetchCSVData, convertToExcel, fetchAllHubsData } from "@/utils/dataUtils"
import axios from "axios"

async function login() {
  console.debug("Attempting to log in.....")
  const response = await axios.post(
    "https://projectxuaeapi.shipsy.io/api/dashboard/login",
    {
      username: "data@chronodiali.ma",
      pwd: "lGU2flbcnsemIdr4QlIFTkzRvl5zyMJTT/b2YZz714DrQDk3K5pmGcGbYjcmM5CXmCWa8v4AnB3kr7x2IZkcNov5/9WS0UQv0d7NKs0hhN373vAn7HR9zrDbNp8aFW3sCWLvbdieonO0Q0prs6mRB3pU3wFgxwCwK+SNSKtEv5XCdxQ96E9YMxcTPT0p5N6+Ue1/rbZeRbN7VlxuglH/aVjBnlqNELuODzKiP7WdFSvTtdWsGNnjh4q8QWuIy1GPMdXiTGONiU/7IJXemKfpDYdeM4jkGSpC6CCuLLNkJdA9Z+59XUysonKC/3anXvgfvnuWjgW1mTEXZ7rD1cTLrg==",
    },
    { headers: { "organisation-id": "chronodiali" } },
  )
  console.debug("Login successful, access token received.")
  return response.data.data.access_token.id
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hubs, setHubs] = useState<Array<{ id: string; name: string }>>([])
  const [selectedHub, setSelectedHub] = useState<string | null>(null)
  const [selectAllHubs, setSelectAllHubs] = useState(false)

  useEffect(() => {
    const loadHubs = () => {
      try {
        const hubsData = fetchHubs()
        setHubs(hubsData)
      } catch (err) {
        console.error("Error loading hubs:", err)
        setError("Failed to load hubs. Please try again.")
      }
    }

    loadHubs()
  }, [])

  const handleConvert = async () => {
    if (!selectAllHubs && !selectedHub) {
      setError("Please select a hub or choose to convert all hubs.")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const accessToken = await login()
      let result

      if (selectAllHubs) {
        const allHubsData = await fetchAllHubsData(accessToken)
        result = await convertToExcel(allHubsData)
      } else {
        const csvData = await fetchCSVData(accessToken, selectedHub!)
        result = await convertToExcel(csvData)
      }

      // Create main Excel file
      const mainBlob = new Blob([result.mainBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      // Download main file
      const mainUrl = window.URL.createObjectURL(mainBlob)
      const mainLink = document.createElement("a")
      mainLink.href = mainUrl
      mainLink.setAttribute("download", selectAllHubs ? "all_hubs_data.xlsx" : `${selectedHub}_data.xlsx`)
      document.body.appendChild(mainLink)
      mainLink.click()
      mainLink.parentNode?.removeChild(mainLink)

      setSuccess("Conversion successful! The Excel file has been downloaded.")
    } catch (err) {
      setError("An error occurred during the conversion process.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <Card >
        <CardHeader>
          <CardTitle>CSV to Excel Converter</CardTitle>
          <CardDescription>Select a hub and convert CSV to Excel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="selectAllHubs"
              checked={selectAllHubs}
              onCheckedChange={(checked) => {
                setSelectAllHubs(checked as boolean)
                if (checked) {
                  setSelectedHub(null)
                }
              }}
            />
            <label htmlFor="selectAllHubs">Convert data for all hubs</label>
          </div>
          <Select onValueChange={setSelectedHub} disabled={selectAllHubs}>
            <SelectTrigger>
              <SelectValue placeholder="Select a hub" />
            </SelectTrigger>
            <SelectContent>
              {hubs.map((hub) => (
                <SelectItem key={hub.id} value={hub.id}>
                  {hub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleConvert} disabled={isLoading || (!selectAllHubs && !selectedHub)}>
            {isLoading ? "Converting..." : "Convert CSV to Excel"}
          </Button>
          {error && <p className="text-red-500 mt-2">{error}</p>}
          {success && <p className="text-green-500 mt-2">{success}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

