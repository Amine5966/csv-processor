"use server"

import * as XLSX from "xlsx"

interface RowData {
  [key: string]: string
}

type WhitelistClients = {
  [key: string]: string;
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
  "2989": "TIGHT AND SLEEK"
}

interface CustomerSummary {
  customerCode: string;
  totalCODAfterCalculation: number;
  isWhitelisted: boolean;
  clientName: string | null;
}

export async function processExcel(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) throw new Error("No file uploaded")

  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
  const originalFileName = `generated_invoices_${today}.xlsx`; // New filename format

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "buffer" })

  // Assume the first sheet is the one to process
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data: RowData[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  // Extract headers and rows
  const headers = data[0] as string[]
  const rows = data.slice(1).map(row => {
    const rowData: RowData = {}
    headers.forEach((header, index) => {
      rowData[header] = row[index]?.toString() || ""
    })
    return rowData
  })

  // Group data by Customer Code
  const groupedData: { [key: string]: RowData[] } = {}
  rows.forEach(row => {
    const customerCode = (row["Customer Code"] || row["Customer Code"]).trim().replace(/^\ufeff/, '')
    if (!groupedData[customerCode]) groupedData[customerCode] = []
    groupedData[customerCode].push(row)
  })

  const outputWorkbook = XLSX.utils.book_new()
  const summaries: CustomerSummary[] = []

  for (const [customerCode, rows] of Object.entries(groupedData)) {
    const isWhitelisted = customerCode in WHITELIST_CLIENTS
    const clientName = WHITELIST_CLIENTS[customerCode] || null
    let totalCODAfterCalculation = 0

    const processedRows = rows.map(row => {
      if (isWhitelisted) return { ...row } // No modifications for whitelisted

      // Calculate Total Freight
      const freightCharge = parseFloat(row["Freight Charge"] || row["﻿Freight Charge"] || "0")
      const excessWeightCharge = parseFloat(row["Excess Weight Charge"] || row["﻿Excess Weight Charge"] || "0")
      const monthlyOrderCharge = parseFloat(row["Monthly Order Charge"] || row["﻿Monthly Order Charge"] || "0")
      const monthlyExcessWeightCharge = parseFloat(row["Monthly Excess Weight Charge"] || row["﻿Monthly Excess Weight Charge"] || "0")
      const codCharges = parseFloat(row["COD Charges"] || row["﻿COD Charges"] || "0")
      const rtoCharge = parseFloat(row["RTO Charge"] || row["﻿RTO Charge"] || "0")
      const insuranceCharge = parseFloat(row["Insurance Charge"] || row["﻿Insurance Charge"] || "0")
      const discountCharge = parseFloat(row["Discount Charge"] || row["﻿Discount Charge"] || "0")
      const vatCharge = parseFloat(row["VAT Charge"] || row["﻿VAT Charge"] || "0")

      const totalFreight = freightCharge + excessWeightCharge + monthlyOrderCharge + monthlyExcessWeightCharge + codCharges + rtoCharge + insuranceCharge + discountCharge + vatCharge

      // Calculate COD total (not added to Excel)
      const codAmount = parseFloat(row["COD amount"] || row["﻿COD amount"] || "0")
      totalCODAfterCalculation += codAmount - totalFreight

      return { ...row, "Total Freight": totalFreight.toFixed(2), "COD Amount After Calculation": (codAmount - totalFreight).toFixed(2) }
    })

    summaries.push({
      customerCode,
      totalCODAfterCalculation: isWhitelisted ? 0 : totalCODAfterCalculation,
      isWhitelisted,
      clientName
    })

    const outputWorksheet = XLSX.utils.json_to_sheet(processedRows)
    XLSX.utils.book_append_sheet(outputWorkbook, outputWorksheet, customerCode.slice(0, 31)) // Sheet name limit
  }

  const excelBuffer = XLSX.write(outputWorkbook, { bookType: "xlsx", type: "array" })
  return { buffer: excelBuffer, summaries, fileName: originalFileName }
}