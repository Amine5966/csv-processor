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

export async function processExcel(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) throw new Error("No file uploaded")

  const today = new Date().toISOString().split("T")[0]
  const originalFileName = `generated_invoices_${today}.xlsx`

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "buffer" })

  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data: RowData[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  const headers = data[0] as unknown as string[]
  const rows = data.slice(1)

  // Add only the two calculated columns to the original headers
  const outputHeaders = [...headers, "Total Freight", "COD Amount After Calculation"]
  const processedRows: RowData[] = []
  const summaries: {
    customerCode: string
    totalCODAfterCalculation: number
    isWhitelisted: boolean
    clientName: string | null
  }[] = []

  rows.forEach((row: any) => {
    const rowData: RowData = {}
    headers.forEach((header, index) => {
      if (header) {
        // Only include columns with headers
        rowData[header] = row[index]?.toString() || ""
      }
    })

    const customerCode = (rowData["Customer Code"] || "")
      .toString()
      .trim()
      .replace(/^\ufeff/, "")
    const isWhitelisted = customerCode in WHITELIST_CLIENTS

    // Calculate Total Freight
    const freightCharge = Number(rowData["Freight Charge"]) || 0
    const excessWeightCharge = Number(rowData["Excess Weight Charge"]) || 0
    const monthlyOrderCharge = Number(rowData["Monthly Order Charge"]) || 0
    const monthlyExcessWeightCharge = Number(rowData["Monthly Excess Weight Charge"]) || 0
    const codCharges = Number(rowData["COD Charges"]) || 0
    const rtoCharge = Number(rowData["RTO Charge"]) || 0
    const insuranceCharge = Number(rowData["Insurance Charge"]) || 0
    const discountCharge = Number(rowData["Discount Charge"]) || 0
    const vatCharge = Number(rowData["VAT Charge"]) || 0

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
    const codAmount = Number(rowData["COD amount"]) || 0
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

