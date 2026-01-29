import { BulkProspect, BULK_CSV_COLUMNS } from './types';

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  prospects: BulkProspect[];
  rowCount: number;
}

const MAX_PROSPECTS = 5000;

// Column name aliases for flexible matching
const COLUMN_ALIASES: Record<string, string[]> = {
  'Target Prospect First Name': ['first name', 'firstname', 'first_name', 'fname'],
  'Target Prospect Last Name': ['last name', 'lastname', 'last_name', 'lname', 'surname'],
  'Target Prospect Email': ['email', 'email address', 'emailaddress', 'e-mail'],
  'Target Prospect Job Title': ['job title', 'jobtitle', 'job_title', 'title', 'position', 'role'],
  'Target Prospect Company Name': ['company name', 'companyname', 'company_name', 'company', 'organization', 'org'],
  'Target Prospect Website': ['website', 'company website', 'url', 'site', 'domain', 'web'],
  'Target Prospect Linkedin URL': ['linkedin', 'linkedin url', 'linkedin_url', 'li url', 'linkedin profile'],
  'Target Prospect Company Linkedin URL': ['company linkedin', 'company_linkedin', 'company li', 'org linkedin'],
  'Target Prospect City': ['city', 'location city', 'town'],
  'Target Prospect Country': ['country', 'location country', 'nation'],
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[_\-\s]+/g, ' ');
}

function findColumnMatch(header: string): string | null {
  const normalized = normalizeColumnName(header);
  
  // Check exact matches first
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (normalizeColumnName(canonical) === normalized) {
      return canonical;
    }
    for (const alias of aliases) {
      if (alias === normalized) {
        return canonical;
      }
    }
  }
  
  // Check partial matches
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return canonical;
      }
    }
  }
  
  return null;
}

export function parseCSV(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // Parse CSV properly handling quoted fields
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };
  
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  
  return { headers, rows };
}

export function validateAndParseCSV(csvContent: string): CSVValidationResult {
  const result: CSVValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    prospects: [],
    rowCount: 0,
  };
  
  const { headers, rows } = parseCSV(csvContent);
  
  if (headers.length === 0) {
    result.isValid = false;
    result.errors.push('CSV file is empty or has no headers');
    return result;
  }
  
  // Map headers to canonical names
  const columnMap: Record<number, string> = {};
  const foundColumns = new Set<string>();
  
  headers.forEach((header, index) => {
    const canonical = findColumnMatch(header);
    if (canonical) {
      columnMap[index] = canonical;
      foundColumns.add(canonical);
    }
  });
  
  // Check for required columns
  const missingRequired = BULK_CSV_COLUMNS.required.filter(col => !foundColumns.has(col));
  if (missingRequired.length > 0) {
    result.isValid = false;
    result.errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
    return result;
  }
  
  // Check for optional columns
  const missingOptional = BULK_CSV_COLUMNS.optional.filter(col => !foundColumns.has(col));
  if (missingOptional.length > 0) {
    result.warnings.push(`Optional columns not found (will be skipped): ${missingOptional.join(', ')}`);
  }
  
  // Check row count
  if (rows.length === 0) {
    result.isValid = false;
    result.errors.push('CSV has no data rows');
    return result;
  }
  
  if (rows.length > MAX_PROSPECTS) {
    result.isValid = false;
    result.errors.push(`CSV has ${rows.length} rows, but maximum allowed is ${MAX_PROSPECTS}`);
    return result;
  }
  
  result.rowCount = rows.length;
  
  // Parse each row into a BulkProspect
  const validationErrors: string[] = [];
  
  rows.forEach((row, rowIndex) => {
    const prospect: BulkProspect = {
      rowIndex: rowIndex + 2, // +2 because 1-indexed and header row
      firstName: '',
      lastName: '',
      email: '',
      jobTitle: '',
      companyName: '',
      website: '',
      status: 'pending',
    };
    
    // Map row values to prospect fields
    row.forEach((value, colIndex) => {
      const canonical = columnMap[colIndex];
      if (!canonical) return;
      
      const cleanValue = value.trim();
      
      switch (canonical) {
        case 'Target Prospect First Name':
          prospect.firstName = cleanValue;
          break;
        case 'Target Prospect Last Name':
          prospect.lastName = cleanValue;
          break;
        case 'Target Prospect Email':
          prospect.email = cleanValue;
          break;
        case 'Target Prospect Job Title':
          prospect.jobTitle = cleanValue;
          break;
        case 'Target Prospect Company Name':
          prospect.companyName = cleanValue;
          break;
        case 'Target Prospect Website':
          prospect.website = cleanValue;
          break;
        case 'Target Prospect Linkedin URL':
          prospect.linkedinUrl = cleanValue || undefined;
          break;
        case 'Target Prospect Company Linkedin URL':
          prospect.companyLinkedinUrl = cleanValue || undefined;
          break;
        case 'Target Prospect City':
          prospect.city = cleanValue || undefined;
          break;
        case 'Target Prospect Country':
          prospect.country = cleanValue || undefined;
          break;
      }
    });
    
    // Validate required fields
    const rowNum = rowIndex + 2;
    const rowErrors: string[] = [];
    
    if (!prospect.firstName) rowErrors.push('First Name');
    if (!prospect.email) rowErrors.push('Email');
    if (!prospect.companyName) rowErrors.push('Company Name');
    if (!prospect.website) rowErrors.push('Website');
    
    if (rowErrors.length > 0) {
      validationErrors.push(`Row ${rowNum}: Missing ${rowErrors.join(', ')}`);
      prospect.status = 'failed';
      prospect.error = `Missing required fields: ${rowErrors.join(', ')}`;
    }
    
    // Validate email format
    if (prospect.email && !isValidEmail(prospect.email)) {
      validationErrors.push(`Row ${rowNum}: Invalid email format`);
    }
    
    // Determine confidence based on available data
    prospect.confidence = calculateConfidence(prospect);
    
    result.prospects.push(prospect);
  });
  
  // Add validation errors as warnings (don't fail the whole upload)
  if (validationErrors.length > 0) {
    if (validationErrors.length <= 10) {
      result.warnings.push(...validationErrors);
    } else {
      result.warnings.push(...validationErrors.slice(0, 10));
      result.warnings.push(`... and ${validationErrors.length - 10} more row issues`);
    }
  }
  
  return result;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function calculateConfidence(prospect: BulkProspect): 'high' | 'medium' | 'low' {
  let score = 0;
  
  // Required fields
  if (prospect.firstName) score += 1;
  if (prospect.lastName) score += 1;
  if (prospect.email) score += 1;
  if (prospect.jobTitle) score += 1;
  if (prospect.companyName) score += 1;
  if (prospect.website) score += 2; // Website is most important for research
  
  // Optional but helpful fields
  if (prospect.linkedinUrl) score += 2;
  if (prospect.companyLinkedinUrl) score += 1;
  if (prospect.city || prospect.country) score += 1;
  
  // Max possible: 11
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function generateOutputCSV(prospects: BulkProspect[]): string {
  const allHeaders = [
    ...BULK_CSV_COLUMNS.required,
    ...BULK_CSV_COLUMNS.optional,
    ...BULK_CSV_COLUMNS.output,
  ];
  
  const escapeCSV = (value: string | undefined): string => {
    if (!value) return '';
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  
  const headerRow = allHeaders.map(escapeCSV).join(',');
  
  const dataRows = prospects.map(prospect => {
    const values = [
      prospect.firstName,
      prospect.lastName,
      prospect.email,
      prospect.jobTitle,
      prospect.companyName,
      prospect.website,
      prospect.linkedinUrl || '',
      prospect.companyLinkedinUrl || '',
      prospect.city || '',
      prospect.country || '',
      prospect.generatedEmail1 || '',
      prospect.generatedEmail2 || '',
      prospect.generatedEmail3 || '',
    ];
    return values.map(escapeCSV).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}
