"use server"

import * as XLSX from "xlsx"
import axios from "axios"
import { format } from "date-fns"

// Add delay function for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface RowData {
  [key: string]: string | number
}

type WhitelistClients = {
  [key: string]: string
}

type ProgressCallback = (progress: number, message: string) => void

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

const excessWeightData = [
  { shipperName: "KITEA.COM", excessWeight: 20, customerCode: 1814 },
  { shipperName: "Wildaty", excessWeight: 20, customerCode: 1534 },
  { shipperName: "KS TECHNOLOGY", excessWeight: 30, customerCode: 882 },
  { shipperName: "Mylerz", excessWeight: 16, customerCode: 1702 },
  { shipperName: "Petmarketmaroc.com", excessWeight: 25, customerCode: 1788 },
  { shipperName: "IKEA MAROC", excessWeight: 20, customerCode: 2062 },
  { shipperName: "Allo bebe", excessWeight: 20, customerCode: 2145 },
  { shipperName: "Livrairie.ma", excessWeight: 30, customerCode: 2219 },
  { shipperName: "GLOVOAPP MOROCCO", excessWeight: 30, customerCode: 2395 },
  { shipperName: "SONAJUTE.MA", excessWeight: 30, customerCode: 2477 },
  { shipperName: "EQUICK", excessWeight: 10, customerCode: 2738 },
  { shipperName: "EQUICK", excessWeight: 10, customerCode: 965 },
]

const surchargeData = [
  { shipperName: "OFFRE MYMARKET", surcharge: 3.0, customerCode: 2480 },
  { shipperName: "Wildaty", surcharge: 3.0, customerCode: 1534 },
  { shipperName: "MYSHEMSI", surcharge: 4.0, customerCode: 2368 },
  { shipperName: "SONAJUTE.MA", surcharge: 4.0, customerCode: 2477 },
  { shipperName: "EQUICK", surcharge: 1.0, customerCode: 2738 },
  { shipperName: "EQUICK", surcharge: 1.0, customerCode: 965 },
  { shipperName: "MARIJANE MALL", surcharge: 2.8, customerCode: 1244 },
]

// Default values for shippers not in excessWeightData
const DEFAULT_EXCESS_WEIGHT_THRESHOLD = 15 // kg
const DEFAULT_EXCESS_WEIGHT_CHARGE = 5 // DH per kg

const EXCLUDED_COLUMNS = [
  "Final Price",
  "Shipper Tracking Number",
  "Monthly Order Charge",
  "Monthly Excess Weight Charge",
  "Discount Charge",
  "VAT Charge",
  "Invoice Number",
  "Invoice Date",
]

function formatNumber(num: number): number | string {
  if (Number.isInteger(num)) {
    return num
  }
  return Number(num.toFixed(2))
}

async function login() {
  console.debug("Tentative de connexion.....")
  const response = await axios.post(
    "https://projectxuaeapi.shipsy.io/api/dashboard/login",
    {
      username: "data@chronodiali.ma",
      pwd: "lGU2flbcnsemIdr4QlIFTkzRvl5zyMJTT/b2YZz714DrQDk3K5pmGcGbYjcmM5CXmCWa8v4AnB3kr7x2IZkcNov5/9WS0UQv0d7NKs0hhN373vAn7HR9zrDbNp8aFW3sCWLvbdieonO0Q0prs6mRB3pU3wFgxwCwK+SNSKtEv5XCdxQ96E9YMxcTPT0p5N6+Ue1/rbZeRbN7VlxuglH/aVjBnlqNELuODzKiP7WdFSvTtdWsGNnjh4q8QWuIy1GPMdXiTGONiU/7IJXemKfpDYdeM4jkGSpC6CCuLLNkJdA9Z+59XUysonKC/3anXvgfvnuWjgW1mTEXZ7rD1cTLrg==",
    },
    { headers: { "organisation-id": "chronodiali" } },
  )
  console.debug("Connexion réussie, jeton d'accès reçu.")
  return response.data.data.access_token.id
}

// Optimized batch API call function
async function fetchConsignmentDetailsBatch(
  accessToken: string,
  referenceNumbers: string[],
  onProgress?: ProgressCallback,
) {
  console.debug(`Traitement par lots de ${referenceNumbers.length} références client 565...`)

  const results = new Map<string, any>()
  const BATCH_SIZE = 5 // Process 5 requests in parallel
  const DELAY_BETWEEN_BATCHES = 200 // 200ms delay between batches

  // Split into batches
  const batches = []
  for (let i = 0; i < referenceNumbers.length; i += BATCH_SIZE) {
    batches.push(referenceNumbers.slice(i, i + BATCH_SIZE))
  }

  console.debug(`Divisé en ${batches.length} lots de ${BATCH_SIZE} requêtes maximum`)

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]

    // Update progress
    const progressPercent = (batchIndex / batches.length) * 100
    onProgress?.(50 + progressPercent * 0.3, `Traitement du lot ${batchIndex + 1}/${batches.length} pour client 565...`)

    // Process batch in parallel
    const batchPromises = batch.map(async (referenceNumber) => {
      try {
        await delay(50) // Small delay to avoid overwhelming the API
        const response = await axios.get(
          `https://projectxuaeapi.shipsy.io/api/CRMDashboard/consignments/fetchOne?referenceNumber=${referenceNumber}&send_unmasked_data=false`,
          {
            headers: {
              accept: "application/json, text/plain, */*",
              "access-token": accessToken,
              "organisation-id": "chronodiali",
              "user-id": "2102825743602945225",
            },
            timeout: 8000, // Reduced timeout to 8 seconds
          },
        )
        return { referenceNumber, data: response.data[0] }
      } catch (error: any) {
        console.error(`Erreur pour la référence ${referenceNumber}:`, error.message)
        return { referenceNumber, data: null }
      }
    })

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises)

    // Store results
    batchResults.forEach(({ referenceNumber, data }) => {
      if (data) {
        results.set(referenceNumber, data)
      }
    })

    console.debug(`Lot ${batchIndex + 1} terminé: ${batchResults.filter((r) => r.data).length}/${batch.length} succès`)

    // Delay between batches (except for the last one)
    if (batchIndex < batches.length - 1) {
      await delay(DELAY_BETWEEN_BATCHES)
    }
  }

  console.debug(`Traitement par lots terminé: ${results.size}/${referenceNumbers.length} références récupérées`)
  return results
}

async function fetchInvoiceData(accessToken: string, fromDate: string, toDate: string) {
  console.debug(`Récupération des données de facture du ${fromDate} au ${toDate}...`)
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
  console.debug("Données de facture récupérées avec succès.")
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

async function fetchAndProcessData(fromDate: string, toDate: string, onProgress?: ProgressCallback) {
  console.debug("Début de la récupération et du traitement des données...")
  onProgress?.(5, "Connexion en cours...")

  const accessToken = await login()
  console.debug("Jeton d'accès reçu.")
  onProgress?.(10, "Récupération des données de facture...")

  // Parse the ISO strings to Date objects
  const fromDateObj = new Date(fromDate)
  const toDateObj = new Date(toDate)

  // Format the dates for the API call
  const fsdate = format(fromDateObj, "yyyy-MM-dd")
  const fldate = format(toDateObj, "yyyy-MM-dd")
  console.debug(`Date de début formatée: ${fsdate}`)
  console.debug(`Date de fin formatée: ${fldate}`)

  const invoiceData = await fetchInvoiceData(accessToken, fsdate, fldate)
  console.debug(`${invoiceData.length} enregistrements de facture récupérés.`)
  onProgress?.(20, `${invoiceData.length} fichiers de facture trouvés à traiter...`)

  let allData: RowData[] = []

  const fetchPromises = invoiceData.map(async (item: any, index: number) => {
    console.debug(`Récupération du fichier depuis le lien: ${item.fileLink}`)
    try {
      const response = await axios.get(item.fileLink)
      const { data } = parseCSV(response.data)
      onProgress?.(
        20 + ((index + 1) / invoiceData.length) * 25,
        `Traitement du fichier ${index + 1} sur ${invoiceData.length}...`,
      )
      return data
    } catch (error) {
      console.error(`Erreur lors de la récupération du fichier depuis ${item.fileLink}:`, error)
      return []
    }
  })

  const results = await Promise.all(fetchPromises)

  allData = results.flat()
  onProgress?.(45, `Traitement de ${allData.length} enregistrements...`)

  console.debug("Récupération et traitement des données terminés.")
  return processData(allData, onProgress, accessToken)
}

async function processData(data: RowData[], onProgress?: ProgressCallback, accessToken?: string) {
  console.debug("Traitement des données...")
  const processedRows: RowData[] = []
  const summaries: {
    customerCode: string
    totalCODAfterCalculation: number
    isWhitelisted: boolean
    clientName: string | null
  }[] = []

  // Get access token if not provided
  if (!accessToken) {
    accessToken = await login()
  }

  // Pre-fetch all customer 565 consignment details in batches
  const customer565References = data
    .filter((row) => {
      const customerCode = (row["Customer Code"] || "")
        .toString()
        .trim()
        .replace(/^\ufeff/, "")
      return customerCode === "565" && row["Reference Number"]?.toString()
    })
    .map((row) => row["Reference Number"]?.toString())
    .filter((ref): ref is string => !!ref)

  // Remove duplicates
  const uniqueReferences = [...new Set(customer565References)]
  console.debug(`Trouvé ${uniqueReferences.length} références uniques pour le client 565`)

  // Batch fetch all consignment details
  let consignmentCache = new Map<string, any>()
  if (uniqueReferences.length > 0) {
    onProgress?.(50, `Récupération des détails pour ${uniqueReferences.length} références client 565...`)
    consignmentCache = await fetchConsignmentDetailsBatch(accessToken, uniqueReferences, onProgress)
  }

  // Process all rows
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const processedRow: RowData = { ...row }

    const customerCode = (row["Customer Code"] || "")
      .toString()
      .trim()
      .replace(/^\ufeff/, "")
    const isWhitelisted = customerCode in WHITELIST_CLIENTS

    let freightCharge = Number(row["Freight Charge"]) || 0
    let excessWeightCharge = Number(row["Excess Weight Charge"]) || 0
    const monthlyOrderCharge = Number(row["Monthly Order Charge"]) || 0
    const monthlyExcessWeightCharge = Number(row["Monthly Excess Weight Charge"]) || 0
    let codCharges = Number(row["COD Charges"]) || 0

    const status = row["Status"]?.toString().toLowerCase() || ""
    const codAmount = status === "rto_delivered" ? 0 : Number(row["COD amount"]) || 0
    const referenceNumber = row["Reference Number"]?.toString() || ""
    const chargeableWeight = Number(row["Chargeable Weight"]) || 0

    // Enhanced excess weight calculation logic
    const customerCodeNum = Number.parseInt(customerCode)
    const excessWeightConfig = excessWeightData.find((config) => config.customerCode === customerCodeNum)

    if (excessWeightConfig) {
      // Special shipper - use custom threshold and surcharge
      const surchargeConfig = surchargeData.find((config) => config.customerCode === customerCodeNum)

      if (surchargeConfig) {
        if (chargeableWeight <= excessWeightConfig.excessWeight) {
          excessWeightCharge = 0
        } else {
          const excessWeight = chargeableWeight - excessWeightConfig.excessWeight
          excessWeightCharge = excessWeight * surchargeConfig.surcharge
        }
      } else {
        // Fallback to default if no surcharge config found
        if (chargeableWeight <= excessWeightConfig.excessWeight) {
          excessWeightCharge = 0
        } else {
          const excessWeight = chargeableWeight - excessWeightConfig.excessWeight
          excessWeightCharge = excessWeight * DEFAULT_EXCESS_WEIGHT_CHARGE
        }
      }
    } else {
      // Default shipper - use default threshold (15kg) and charge (5 DH/kg)
      if (chargeableWeight <= DEFAULT_EXCESS_WEIGHT_THRESHOLD) {
        excessWeightCharge = 0
      } else {
        const excessWeight = chargeableWeight - DEFAULT_EXCESS_WEIGHT_THRESHOLD
        excessWeightCharge = excessWeight * DEFAULT_EXCESS_WEIGHT_CHARGE
      }
    }

    // Special condition for customer code 704
    if (customerCode === "704" && status === "delivered" && codAmount !== 0) {
      const innerOuter = (row["Inner/Outer"] || "").toString().toLowerCase().trim()
      if (innerOuter === "inner") {
        codCharges = 5
      } else if (innerOuter === "outer") {
        codCharges = 4.75
      }
    }

    // Special condition for customer code 565 - use pre-fetched data
    if (customerCode === "565" && referenceNumber) {
      const consignmentDetails = consignmentCache.get(referenceNumber)
      if (consignmentDetails && consignmentDetails.destination_hub_code === "EXT01") {
        freightCharge = 48.16
      }
    }

    // Update progress every 500 rows
    if (i % 500 === 0) {
      const progressPercent = (i / data.length) * 100
      onProgress?.(80 + progressPercent * 0.1, `Traitement de la ligne ${i + 1} sur ${data.length}...`)
    }

    // Rest of the processing logic remains the same...
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
  }

  onProgress?.(90, "Finalisation du traitement des données...")
  console.debug("Traitement des données terminé.")
  return { processedRows, summaries }
}

export async function processExcel(formData: FormData) {
  console.debug("Traitement du fichier Excel...")

  for (const [key, value] of formData.entries()) {
    console.debug(`FormData - ${key}: ${value}`)
  }

  const file = formData.get("file") as File | null
  const fromDate = formData.get("fromDate") as string | null
  const toDate = formData.get("toDate") as string | null

  console.debug(`Fichier: ${file ? "Détecté" : "Non détecté"}`)
  console.debug(`Date de début: ${fromDate}`)
  console.debug(`Date de fin: ${toDate}`)

  let processedData, summaries

  if (file && file instanceof File && file.size > 0) {
    console.debug("Fichier détecté, traitement du fichier...")

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet) as RowData[]

    const result = await processData(rawData)
    processedData = result.processedRows
    summaries = result.summaries
  } else if (fromDate && toDate) {
    console.debug("Plage de dates détectée, récupération des données...")
    const result = await fetchAndProcessData(fromDate, toDate)
    processedData = result.processedRows
    summaries = result.summaries
  } else {
    console.error("Entrée invalide: Un fichier ou une plage de dates est requis")
    throw new Error("Entrée invalide: Un fichier ou une plage de dates est requis")
  }

  const outputWorkbook = XLSX.utils.book_new()
  const outputWorksheet = XLSX.utils.json_to_sheet(processedData)
  XLSX.utils.book_append_sheet(outputWorkbook, outputWorksheet, "Données Traitées")

  const excelBuffer = XLSX.write(outputWorkbook, { bookType: "xlsx", type: "array" })
  const today = new Date().toISOString().split("T")[0]

  console.debug("Fichier Excel traité avec succès.")
  return { buffer: excelBuffer, summaries, fileName: `factures_generees_${today}.xlsx` }
}
