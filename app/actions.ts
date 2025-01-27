"use server"

import { parse } from "papaparse"
import * as XLSX from "xlsx"

interface RowData {
  [key: string]: string
}

// Define the whitelist type for better type safety
type WhitelistClients = {
  [key: string]: string;
}

// Add the client whitelist at the top of the file
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

export async function processCSV(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) {
    throw new Error("No file uploaded")
  }

  // Get the original filename and parse its components
  const originalFileName = file.name
  const fileName = originalFileName
    .replace('.csv', '') // Remove .csv extension
    .replace('invoice', 'processed') // Replace 'invoice' with 'processed'
    .concat('.xlsx') // Add .xlsx extension

  const content = await file.text()
  const { data } = parse<RowData>(content, { header: true })

  const firstRow = data[0] as RowData
  let customerCode = firstRow["Customer Code"] || firstRow["﻿Customer Code"]
  
  if (!customerCode) {
    throw new Error("Customer Code not found in CSV")
  }

  // Clean the customer code by removing any hidden characters and trimming whitespace
  customerCode = customerCode.trim().replace(/^\ufeff/, '')

  // If customer is in whitelist, just convert to Excel without modifications
  if (customerCode in WHITELIST_CLIENTS) {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
    
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    return {
      buffer: excelBuffer,
      totalCODAfterCalculation: 0,
      customerCode,
      isWhitelisted: true,
      clientName: WHITELIST_CLIENTS[customerCode],
      fileName
    }
  }

  // If not in whitelist, proceed with the original calculation logic
  let totalCODAfterCalculation = 0

  const processedData = data.map((row) => {
    const freightCharge = Number.parseFloat(row["Freight Charge"] || row["﻿Freight Charge"] || "0")
    const excessWeightCharge = Number.parseFloat(row["Excess Weight Charge"] || row["﻿Excess Weight Charge"] || "0")
    const monthlyOrderCharge = Number.parseFloat(row["Monthly Order Charge"] || row["﻿Monthly Order Charge"] || "0")
    const monthlyExcessWeightCharge = Number.parseFloat(
      row["Monthly Excess Weight Charge"] || row["﻿Monthly Excess Weight Charge"] || "0",
    )
    const codCharges = Number.parseFloat(row["COD Charges"] || row["﻿COD Charges"] || "0")
    const rtoCharge = Number.parseFloat(row["RTO Charge"] || row["﻿RTO Charge"] || "0")
    const insuranceCharge = Number.parseFloat(row["Insurance Charge"] || row["﻿Insurance Charge"] || "0")
    const discountCharge = Number.parseFloat(row["Discount Charge"] || row["﻿Discount Charge"] || "0")
    const vatCharge = Number.parseFloat(row["VAT Charge"] || row["﻿VAT Charge"] || "0")

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

    const codAmount = Number.parseFloat(row["COD amount"] || row["﻿COD amount"] || "0")
    const codAmountAfterCalculation = codAmount - totalFreight

    totalCODAfterCalculation += codAmountAfterCalculation

    return {
      ...row,
      "Total Freight": totalFreight.toFixed(2),
      "COD Amount After Calculation": codAmountAfterCalculation.toFixed(2),
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(processedData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Processed Data")

  // Find the 'COD Amount After Calculation' column
  const codAmountAfterCalculationColumn = Object.keys(processedData[0]).findIndex(
    (key) => key === "COD Amount After Calculation",
  )

  if (codAmountAfterCalculationColumn !== -1) {
    const columnLetter = XLSX.utils.encode_col(codAmountAfterCalculationColumn)
    const nextColumnLetter = XLSX.utils.encode_col(codAmountAfterCalculationColumn + 1)
    const lastRow = processedData.length + 1

    worksheet[`${columnLetter}${lastRow}`] = { t: "s", v: "COD Amount After Calculation" }
    worksheet[`${nextColumnLetter}${lastRow}`] = {
      t: "n",
      v: totalCODAfterCalculation,
      z: "#,##0.00"
    }

    if (!worksheet["!cols"]) worksheet["!cols"] = []
    worksheet["!cols"][codAmountAfterCalculationColumn] = { wch: 25 }
    worksheet["!cols"][codAmountAfterCalculationColumn + 1] = { wch: 15 }

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1')
    const lastCol = Math.max(range.e.c, codAmountAfterCalculationColumn + 1)
    const lastRowNum = Math.max(range.e.r, lastRow - 1)
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: lastCol, r: lastRowNum }
    })
  }

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return {
    buffer: excelBuffer,
    totalCODAfterCalculation,
    customerCode,
    isWhitelisted: false,
    clientName: null,
    fileName
  }
}

