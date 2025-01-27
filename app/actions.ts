"use server"

import { parse } from "papaparse"
import * as XLSX from "xlsx"

interface RowData {
  [key: string]: string
}

export async function processCSV(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) {
    throw new Error("No file uploaded")
  }

  const content = await file.text()
  console.log("Raw content first 500 chars:", content.substring(0, 500))

  const { data } = parse<RowData>(content, { header: true })
  console.log("First row sample:", data[0])

  const columnNames = Object.keys(data[0] || {})
  console.log("Available columns:", columnNames)

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

  // Get the customer code from the first row, using type assertion
  const firstRow = processedData[0] as RowData
  const customerCode = firstRow?.["Customer Code"] || firstRow?.["﻿Customer Code"] || "N/A"

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

    console.log('Setting title at:', `${columnLetter}${lastRow}`)
    console.log('Setting total at:', `${nextColumnLetter}${lastRow}`)
    console.log('Total value:', totalCODAfterCalculation)

    // Add the title 'COD Amount After Calculation' in the current column
    worksheet[`${columnLetter}${lastRow}`] = { t: "s", v: "COD Amount After Calculation" }

    // Add the total in the next column (adjacent cell)
    worksheet[`${nextColumnLetter}${lastRow}`] = {
      t: "n",
      v: totalCODAfterCalculation,
      z: "#,##0.00"
    }

    // Adjust column widths for both columns
    if (!worksheet["!cols"]) worksheet["!cols"] = []
    worksheet["!cols"][codAmountAfterCalculationColumn] = { wch: 25 }
    worksheet["!cols"][codAmountAfterCalculationColumn + 1] = { wch: 15 }

    // Update the worksheet range to include our new cells
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1')
    const lastCol = Math.max(range.e.c, codAmountAfterCalculationColumn + 1)
    const lastRowNum = Math.max(range.e.r, lastRow - 1)
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: lastCol, r: lastRowNum }
    })

    console.log('Updated worksheet range:', worksheet['!ref'])
  }

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return {
    buffer: excelBuffer,
    totalCODAfterCalculation,
    customerCode,
  }
}

