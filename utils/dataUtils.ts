import axios from "axios"
import * as XLSX from "xlsx"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
import hubsData from "./hubs.json"

dayjs.extend(customParseFormat)

export function fetchHubs() {
  console.debug("Fetching hubs from local JSON...")
  return hubsData.data.page_data.map((hub: any) => ({
    id: hub.id,
    name: hub.name,
  }))
}

export async function fetchCSVData(accessToken: string, hubId: string) {
  console.debug("Fetching CSV data...")
  const response = await axios.post(
    "https://projectxuaeapi.shipsy.io/api/CRMDashboard/riderReconciliation/depositReportCSV",
    {
      descendingOrder: true,
      nextOrPrev: "first",
      pageNo: 1,
      paginationParams: [],
      resultsPerPage: "50",
      hub_id: hubId,
      bank_deposit_date: [],
      transaction_date: [],
      type: "transactions",
    },
    {
      headers: {
        "user-id": "2102825743602945225",
        "access-token": accessToken,
        "organisation-id": "chronodiali",
      },
    },
  )
  console.debug("CSV data fetched successfully.")
  return response.data
}

export async function convertToExcel(csvData: string) {
  console.debug("===== Starting CSV to Excel conversion =====")
  console.debug("CSV sample:", csvData.split('\n').slice(0, 3))

  // Parse CSV data first to analyze split payments
  const rows = csvData.split('\n').map(row => row.split(','))
  const splitPayments = rows.filter(row => {
    const cmsDepositId = row[5] // CMS Deposit Id column
    return cmsDepositId && cmsDepositId.includes('/')
  })
  console.debug("Found split payments:", splitPayments)

  // Regular Excel conversion
  const workbook = XLSX.read(csvData, { type: "string" })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]

  // Process dates
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_ref = XLSX.utils.encode_cell({ c: C, r: R })
      const cell = worksheet[cell_ref]

      if (cell && (cell_ref.startsWith("G") || cell_ref.startsWith("H"))) {
        console.debug(`Processing date cell ${cell_ref}:`, cell.v)
        if (typeof cell.v === "string" && cell.v.match(/^\d{2}-[A-Z]{3}-\d{4}$/)) {
          cell.t = 's'
          cell.z = '@'
          console.debug(`Updated date cell ${cell_ref} to:`, cell)
        }
      }
    }
  }

  // Create split payments worksheet if any found
  if (splitPayments.length > 0) {
    console.debug("Creating split payments worksheet...")
    const splitWorksheet = XLSX.utils.aoa_to_sheet([
      ['Branch Name', 'Branch Code', 'Amount deposited', 'CMS Deposit Id', 'Transaction Creation Date', 'CMS Deposit Date'],
      ...splitPayments.map(row => [row[0], row[1], row[2], row[5], row[6], row[7]])
    ])

    XLSX.utils.book_append_sheet(workbook, splitWorksheet, 'Split Payments')
    console.debug("Split payments worksheet added")
  }

  // Convert to Excel buffer
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellDates: true,
    dateNF: "DD-MMM-YYYY"
  } as XLSX.WritingOptions)

  console.debug("===== Excel conversion completed =====")
  return {
    mainBuffer: excelBuffer,
    hasSplitPayments: splitPayments.length > 0
  }
}

export async function fetchAllHubsData(accessToken: string) {
  console.debug("Fetching data for all hubs...")
  const hubs = fetchHubs()
  let combinedData = ""
  let isFirstHub = true

  for (const hub of hubs) {
    const csvData = await fetchCSVData(accessToken, hub.id)
    if (isFirstHub) {
      combinedData = csvData
      isFirstHub = false
    } else {
      // Skip the header row for subsequent hubs
      const lines = csvData.split('\n')
      combinedData += '\n' + lines.slice(1).join('\n')
    }
  }

  console.debug("Data fetched for all hubs.")
  return combinedData
}

