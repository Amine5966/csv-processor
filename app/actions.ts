"use server"

import * as XLSX from "xlsx"
import axios from "axios"
import { format } from "date-fns"

// Add delay function for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface RowData {
  [key: string]: string | number
}

type WhitelistClients = {
  [key: string]: string
}

interface ProgressCallback {
  (progress: number, message: string): void
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
  { shipperName: "OFFRE MYMARKET", surcharge: 3.00, customerCode: 2480 },
  { shipperName: "Wildaty", surcharge: 3.00, customerCode: 1534 },
  { shipperName: "MYSHEMSI", surcharge: 4.00, customerCode: 2368 },
  { shipperName: "SONAJUTE.MA", surcharge: 4.00, customerCode: 2477 },
  { shipperName: "EQUICK", surcharge: 1.00, customerCode: 2738 },
  { shipperName: "EQUICK", surcharge: 1.00, customerCode: 965 },
  { shipperName: "MARIJANE MALL", surcharge: 2.80, customerCode: 1244 },
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
  "Invoice Date"
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

async function fetchConsignmentDetails(accessToken: string, referenceNumber: string, retryCount = 0) {
  console.debug(`Récupération des détails de l'envoi pour le numéro de référence: ${referenceNumber} (tentative ${retryCount + 1})`)
  
  // Add delay between requests to respect rate limits
  if (retryCount > 0) {
    const delayMs = Math.min(1000 * Math.pow(2, retryCount), 10000) // Exponential backoff, max 10 seconds
    console.debug(`Attente de ${delayMs}ms avant nouvelle tentative...`)
    await delay(delayMs)
  } else {
    // Always add a small delay between requests
    await delay(500) // 500ms delay between requests
  }
  
  try {
    const response = await axios.get(
      `https://projectxuaeapi.shipsy.io/api/CRMDashboard/consignments/fetchOne?referenceNumber=${referenceNumber}&send_unmasked_data=false`,
      {
        headers: {
          "accept": "application/json, text/plain, */*",
          "access-token": accessToken,
          "organisation-id": "chronodiali",
          "user-id": "2102825743602945225",
        },
        timeout: 10000, // 10 second timeout
      }
    )
    console.debug(`Détails de l'envoi récupérés pour ${referenceNumber}`)
    return response.data[0] // API returns an array, we need the first item
  } catch (error: any) {
    console.error(`Erreur lors de la récupération des détails de l'envoi pour ${referenceNumber} (tentative ${retryCount + 1}):`, error.message)
    
    // Retry logic for rate limiting and network errors
    if (error.response?.status === 429 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      if (retryCount < 3) { // Max 3 retries
        console.debug(`Nouvelle tentative pour ${referenceNumber} dans ${Math.min(1000 * Math.pow(2, retryCount + 1), 10000)}ms...`)
        return await fetchConsignmentDetails(accessToken, referenceNumber, retryCount + 1)
      }
    }
    
    return null
  }
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
      onProgress?.(20 + (index + 1) / invoiceData.length * 30, `Traitement du fichier ${index + 1} sur ${invoiceData.length}...`)
      return data
    } catch (error) {
      console.error(`Erreur lors de la récupération du fichier depuis ${item.fileLink}:`, error)
      return []
    }
  })

  const results = await Promise.all(fetchPromises)
  
  allData = results.flat()
  onProgress?.(50, `Traitement de ${allData.length} enregistrements...`)

  console.debug("Récupération et traitement des données terminés.")
  return processData(allData, onProgress)
}

async function processData(data: RowData[], onProgress?: ProgressCallback) {
  console.debug("Traitement des données...")
  const processedRows: RowData[] = []
  const summaries: {
    customerCode: string
    totalCODAfterCalculation: number
    isWhitelisted: boolean
    clientName: string | null
  }[] = []

  // Get access token for API calls
  const accessToken = await login()
  
  // Cache for API responses to avoid duplicate calls
  const consignmentCache = new Map<string, any>()
  
  // Count customer 565 rows for progress tracking
  const customer565Rows = data.filter(row => {
    const customerCode = (row["Customer Code"] || "").toString().trim().replace(/^\ufeff/, "")
    return customerCode === "565" && row["Reference Number"]?.toString()
  })
  
  let customer565Processed = 0
  const totalCustomer565 = customer565Rows.length

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
    const customerCodeNum = parseInt(customerCode)
    const excessWeightConfig = excessWeightData.find(config => config.customerCode === customerCodeNum)
    
    if (excessWeightConfig) {
      // Special shipper - use custom threshold and surcharge
      const surchargeConfig = surchargeData.find(config => config.customerCode === customerCodeNum)
      
      if (surchargeConfig) {
        if (chargeableWeight <= excessWeightConfig.excessWeight) {
          excessWeightCharge = 0
          console.debug(`Client spécial ${customerCode}: Poids facturable (${chargeableWeight}) <= seuil (${excessWeightConfig.excessWeight}), frais de surpoids = 0`)
        } else {
          const excessWeight = chargeableWeight - excessWeightConfig.excessWeight
          excessWeightCharge = excessWeight * surchargeConfig.surcharge
          console.debug(`Client spécial ${customerCode}: Poids excédentaire = ${excessWeight}, Frais = ${excessWeight} × ${surchargeConfig.surcharge} = ${excessWeightCharge}`)
        }
      } else {
        console.debug(`Configuration de surcharge non trouvée pour le client spécial ${customerCode}`)
        // Fallback to default if no surcharge config found
        if (chargeableWeight <= excessWeightConfig.excessWeight) {
          excessWeightCharge = 0
        } else {
          const excessWeight = chargeableWeight - excessWeightConfig.excessWeight
          excessWeightCharge = excessWeight * DEFAULT_EXCESS_WEIGHT_CHARGE
          console.debug(`Client spécial ${customerCode} (surcharge par défaut): Poids excédentaire = ${excessWeight}, Frais = ${excessWeight} × ${DEFAULT_EXCESS_WEIGHT_CHARGE} = ${excessWeightCharge}`)
        }
      }
    } else {
      // Default shipper - use default threshold (15kg) and charge (5 DH/kg)
      if (chargeableWeight <= DEFAULT_EXCESS_WEIGHT_THRESHOLD) {
        excessWeightCharge = 0
        console.debug(`Client par défaut ${customerCode}: Poids facturable (${chargeableWeight}) <= seuil par défaut (${DEFAULT_EXCESS_WEIGHT_THRESHOLD}), frais de surpoids = 0`)
      } else {
        const excessWeight = chargeableWeight - DEFAULT_EXCESS_WEIGHT_THRESHOLD
        excessWeightCharge = excessWeight * DEFAULT_EXCESS_WEIGHT_CHARGE
        console.debug(`Client par défaut ${customerCode}: Poids excédentaire = ${excessWeight}, Frais = ${excessWeight} × ${DEFAULT_EXCESS_WEIGHT_CHARGE} = ${excessWeightCharge}`)
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

    // Special condition for customer code 565
    if (customerCode === "565" && referenceNumber) {
      try {
        let consignmentDetails = consignmentCache.get(referenceNumber)
        
        if (!consignmentDetails) {
          consignmentDetails = await fetchConsignmentDetails(accessToken, referenceNumber)
          if (consignmentDetails) {
            consignmentCache.set(referenceNumber, consignmentDetails)
          }
          customer565Processed++
          
          // Update progress for customer 565 API calls
          const apiProgress = totalCustomer565 > 0 ? (customer565Processed / totalCustomer565) * 30 : 0
          const overallProgress = 50 + apiProgress + (i / data.length) * 20
          onProgress?.(Math.min(overallProgress, 90), 
            `Traitement des appels API pour le client 565: ${customer565Processed}/${totalCustomer565} (Ligne ${i + 1}/${data.length})`)
        }
        
        if (consignmentDetails && consignmentDetails.destination_hub_code === "EXT01") {
          freightCharge = 48.16
          console.debug(`Frais de transport mis à jour à 48.16 pour la référence ${referenceNumber} avec hub de destination EXT01`)
        }
      } catch (error) {
        console.error(`Erreur lors du traitement de la condition client 565 pour ${referenceNumber}:`, error)
      }
    } else {
      // Update progress for non-565 rows
      const overallProgress = 50 + (totalCustomer565 > 0 ? 30 : 0) + (i / data.length) * 20
      if (i % 100 === 0) { // Update every 100 rows to avoid too many updates
        onProgress?.(Math.min(overallProgress, 90), `Traitement de la ligne ${i + 1} sur ${data.length}...`)
      }
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

  console.debug(`Fichier: ${file ? 'Détecté' : 'Non détecté'}`)
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
