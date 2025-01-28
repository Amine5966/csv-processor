"use server"

import * as XLSX from "xlsx"

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

// Columns to exclude from the output
const EXCLUDED_COLUMNS = [
  "Final Price",
  "Customer Name",
  "Shipper Tracking Number",
  "Monthly Order Charge",
  "Monthly Excess Weight Charge",
  "Discount Charge",
  "VAT Charge",
  "Excess Weight Charge",
]

export async function processExcel(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) throw new Error("No file uploaded")

  const today = new Date().toISOString().split("T")[0]
  const originalFileName = `generated_invoices_${today}.xlsx`

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "buffer" })

  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // Read as array of arrays first
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

  // Properly type the headers and rows
  const headers = rawData[0].map((h) => String(h))
  const rows = rawData.slice(1)

  // Filter out excluded columns from headers
  const filteredHeaders = headers.filter((header) => !EXCLUDED_COLUMNS.includes(header))

  // Add the calculated columns
  const outputHeaders = [...filteredHeaders, "Total Freight", "COD Amount After Calculation"]
  const processedRows: RowData[] = []
  const summaries: {
    customerCode: string
    totalCODAfterCalculation: number
    isWhitelisted: boolean
    clientName: string | null
  }[] = []

  rows.forEach((row: any[]) => {
    const rowData: RowData = {}

    // Only include non-excluded columns
    headers.forEach((header, index) => {
      if (header && !EXCLUDED_COLUMNS.includes(header)) {
        rowData[header] = row[index]?.toString() || ""
      }
    })

    const customerCode = (rowData["Customer Code"] || "")
      .toString()
      .trim()
      .replace(/^\ufeff/, "")
    const isWhitelisted = customerCode in WHITELIST_CLIENTS

    // Calculate Total Freight (still using all original columns for calculation)
    const freightCharge = Number(row[headers.indexOf("Freight Charge")]) || 0
    const excessWeightCharge = Number(row[headers.indexOf("Excess Weight Charge")]) || 0
    const monthlyOrderCharge = Number(row[headers.indexOf("Monthly Order Charge")]) || 0
    const monthlyExcessWeightCharge = Number(row[headers.indexOf("Monthly Excess Weight Charge")]) || 0
    const codCharges = Number(row[headers.indexOf("COD Charges")]) || 0
    const rtoCharge = Number(row[headers.indexOf("RTO Charge")]) || 0
    const insuranceCharge = Number(row[headers.indexOf("Insurance Charge")]) || 0
    const discountCharge = Number(row[headers.indexOf("Discount Charge")]) || 0
    const vatCharge = Number(row[headers.indexOf("VAT Charge")]) || 0

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

    // Calculate COD Amount After Calculation
    const codAmount = Number(row[headers.indexOf("COD amount")]) || 0
    const codAfterCalculation = isWhitelisted ? codAmount : codAmount - totalFreight

    // Add calculated columns
    rowData["Total Freight"] = totalFreight.toFixed(2)
    rowData["COD Amount After Calculation"] = codAfterCalculation.toFixed(2)

    // Update summaries
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

    processedRows.push(rowData)
  })

  const outputWorkbook = XLSX.utils.book_new()
  const outputWorksheet = XLSX.utils.json_to_sheet(processedRows, { header: outputHeaders })
  XLSX.utils.book_append_sheet(outputWorkbook, outputWorksheet, "Processed Data")

  const excelBuffer = XLSX.write(outputWorkbook, { bookType: "xlsx", type: "array" })
  return { buffer: excelBuffer, summaries, fileName: originalFileName }
}

