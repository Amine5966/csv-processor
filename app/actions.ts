"use server"

import * as XLSX from "xlsx"
import axios from "axios"
import { format } from "date-fns"

interface RowData {
  [key: string]: string | number
}

type WhitelistClients = {
  [key: string]: string
}

const WHITELIST_CLIENTS: WhitelistClients = {
  "520": "FACES",
  "704": "LC WAIKIKI",
  "565": "Marwa",
  "1244": "Marjane Mall",
  "1124": "Excellence",
  "882": "KS TECHNOLOGY",
  "1702": "Mylerz",
  "1814": "KITEA.COM",
  "1831": "BAM MA",
  "1860": "GSM Al Maghrib",
  "1063": "Fulfillment Bridge",
  "2062": "IKEA MAROC",
  "2338": "Lecoinintime Maroc",
  "2394": "CITYMALL",
  "2083": "vapeindustry",
  "2403": "COIN DES PRIX",
  "965": "EQUICK",
  "778": "1MOMENT",
  "1109": "IMILE DELIVERY",
  "2923": "WWW.AMED.MA",
  "2970": "AUBRILLANT",
  "2989": "TIGHT AND SLEEK",
}

const EXCLUDED_COLUMNS = [
  "Final Price",
  "Shipper Tracking Number",
  "Monthly Order Charge",
  "Monthly Excess Weight Charge",
  "Discount Charge",
  "VAT Charge",
  "Excess Weight Charge",
  "Invoice Number",
  "Invoice Date"
]

function formatNumber(num: number): number | string {
  if (Number.isInteger(num)) {
    return num
  }
  return Number(num.toFixed(2))
}

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

async function fetchInvoiceData(accessToken: string, fromDate: string, toDate: string) {
  console.debug(`Fetching invoice data from ${fromDate} to ${toDate}...`)
  const response = await axios.get(
    `https://obbv2uaeapi.shipsy.io/invoice/getDownloadRequests?recordsPerPage=500&page=1&dateType=updated&fromDate=${fromDate}&toDate=${toDate}&generationStatus=Completed&invoiceNumber=&invoiceSentStatus=All`,
    {
      headers: {
        "user-id": "2102825743602945225",
        "access-token": accessToken,
        "organisation-id": "chronodiali",
      },
    },
  )
  console.debug("Invoice data fetched successfully.")
  return response.data.data.data
}

function parseCSV(csvText: string) {
  const lines = csvText.split("\n")
  const headers = lines[0].split(",").map((header) => header.trim())
  const result = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue

    const currentLine = lines[i]
    const values: any[] = []
    let insideQuote = false
    let currentValue = ""

    for (let j = 0; j < currentLine.length; j++) {
      const currentChar = currentLine[j]

      if (currentChar === '"') {
        insideQuote = !insideQuote
      } else if (currentChar === "," && !insideQuote) {
        values.push(currentValue.trim())
        currentValue = ""
      } else {
        currentValue += currentChar
      }
    }
    values.push(currentValue.trim())

    const row: { [key: string]: string } = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })
    result.push(row)
  }

  return { headers, data: result }
}

async function fetchAndProcessData(fromDate: string, toDate: string) {
  console.debug("Starting data fetch and processing...")
  const accessToken = await login()
  console.debug("Access token received.")
  
  // Parse the ISO strings to Date objects
  const fromDateObj = new Date(fromDate)
  const toDateObj = new Date(toDate)
  
  // Format the dates for the API call
  const fsdate = format(fromDateObj, "yyyy-MM-dd")
  const fldate = format(toDateObj, "yyyy-MM-dd")
  console.debug(`Formatted From Date: ${fsdate}`)
  console.debug(`Formatted To Date: ${fldate}`)

  const invoiceData = await fetchInvoiceData(accessToken, fsdate, fldate)
  console.debug(`Fetched ${invoiceData.length} invoice records.`)

  let allData: RowData[] = []

  const fetchPromises = invoiceData.map(async (item: any) => {
    console.debug(`Fetching file from link: ${item.fileLink}`)
    try {
      const response = await axios.get(item.fileLink)
      const { data } = parseCSV(response.data)
      return data
    } catch (error) {
      console.error(`Error fetching file from ${item.fileLink}:`, error)
      return []
    }
  })

  const results = await Promise.all(fetchPromises)
  
  allData = results.flat()

  console.debug("Data fetching and processing completed.")
  return processData(allData)
}

function processData(data: RowData[]) {
  console.debug("Processing data...")
  const processedRows: RowData[] = []
  const summaries: {
    customerCode: string
    totalCODAfterCalculation: number
    isWhitelisted: boolean
    clientName: string | null
  }[] = []

  data.forEach((row) => {
    const processedRow: RowData = { ...row }

    const customerCode = (row["Customer Code"] || "")
      .toString()
      .trim()
      .replace(/^\ufeff/, "")
    const isWhitelisted = customerCode in WHITELIST_CLIENTS

    const freightCharge = Number(row["Freight Charge"]) || 0
    const excessWeightCharge = Number(row["Excess Weight Charge"]) || 0
    const monthlyOrderCharge = Number(row["Monthly Order Charge"]) || 0
    const monthlyExcessWeightCharge = Number(row["Monthly Excess Weight Charge"]) || 0
    const codCharges = Number(row["COD Charges"]) || 0
    const rtoCharge = Number(row["RTO Charge"]) || 0
    const insuranceCharge = Number(row["Insurance Charge"]) || 0
    const discountCharge = Number(row["Discount Charge"]) || 0
    const vatCharge = Number(row["VAT Charge"]) || 0

    const totalFreight =
      freightCharge +
      excessWeightCharge +
      monthlyOrderCharge +
      monthlyExcessWeightCharge +
      codCharges +
      rtoCharge +
      insuranceCharge +
      discountCharge +
      vatCharge

    const status = row["Status"]?.toString().toLowerCase() || ""
    const codAmount = status === "rto_delivered" ? 0 : Number(row["COD amount"]) || 0
    const codAfterCalculation = isWhitelisted ? codAmount : codAmount - totalFreight

    processedRow["Total Freight"] = formatNumber(totalFreight)
    processedRow["COD Amount After Calculation"] = formatNumber(codAfterCalculation)
    processedRow["Status"] = row["Status"] || ""

    processedRow["Freight Charge"] = formatNumber(freightCharge)
    processedRow["Excess Weight Charge"] = formatNumber(excessWeightCharge)
    processedRow["Monthly Order Charge"] = formatNumber(monthlyOrderCharge)
    processedRow["Monthly Excess Weight Charge"] = formatNumber(monthlyExcessWeightCharge)
    processedRow["COD Charges"] = formatNumber(codCharges)
    processedRow["RTO Charge"] = formatNumber(rtoCharge)
    processedRow["Insurance Charge"] = formatNumber(insuranceCharge)
    processedRow["Discount Charge"] = formatNumber(discountCharge)
    processedRow["VAT Charge"] = formatNumber(vatCharge)
    processedRow["COD amount"] = formatNumber(codAmount)

    EXCLUDED_COLUMNS.forEach((column) => {
      delete processedRow[column]
    })

    if (processedRow["Customer Name 1"]) {
      delete processedRow["Customer Name 1"]
    }

    const existingSummary = summaries.find((s) => s.customerCode === customerCode)
    if (existingSummary) {
      existingSummary.totalCODAfterCalculation += codAfterCalculation
    } else {
      summaries.push({
        customerCode,
        totalCODAfterCalculation: codAfterCalculation,
        isWhitelisted,
        clientName: WHITELIST_CLIENTS[customerCode] || null,
      })
    }

    processedRows.push(processedRow)
  })

  console.debug("Data processing completed.")
  return { processedRows, summaries }
}

export async function processExcel(formData: FormData) {
  console.debug("Processing Excel file...")
  
  for (const [key, value] of formData.entries()) {
    console.debug(`FormData - ${key}: ${value}`)
  }

  const file = formData.get("file") as File | null
  const fromDate = formData.get("fromDate") as string | null
  const toDate = formData.get("toDate") as string | null

  console.debug(`File: ${file ? 'Detected' : 'Not Detected'}`)
  console.debug(`From Date: ${fromDate}`)
  console.debug(`To Date: ${toDate}`)

  let processedData, summaries

  if (file && file instanceof File && file.size > 0) {
    console.debug("File detected, processing file...")
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet) as RowData[]
    const result = processData(rawData)
    processedData = result.processedRows
    summaries = result.summaries
  } else if (fromDate && toDate) {
    console.debug("Date range detected, fetching data...")
    const result = await fetchAndProcessData(fromDate, toDate)
    processedData = result.processedRows
    summaries = result.summaries
  } else {
    console.error("Invalid input: Either file or date range is required")
    throw new Error("Invalid input: Either file or date range is required")
  }

  const outputWorkbook = XLSX.utils.book_new()
  const outputWorksheet = XLSX.utils.json_to_sheet(processedData)
  XLSX.utils.book_append_sheet(outputWorkbook, outputWorksheet, "Processed Data")

  const excelBuffer = XLSX.write(outputWorkbook, { bookType: "xlsx", type: "array" })
  const today = new Date().toISOString().split("T")[0]
  console.debug("Excel file processed successfully.")
  return { buffer: excelBuffer, summaries, fileName: `generated_invoices_${today}.xlsx` }
}
