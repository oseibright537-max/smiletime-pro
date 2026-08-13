import { supabase } from "@/integrations/supabase/client";

export interface ParsedEmployeeRow {
  rowIndex: number;
  employee_code: string;
  full_name: string;
  email: string | null;
  department_name: string | null;
  job_title: string | null;
  status: "active" | "suspended" | "terminated";
  rawRow: Record<string, string>;
  validationErrors: string[];
  conflictStatus: "new" | "update" | "invalid";
  existingEmployeeId?: string;
  diffs?: Array<{ field: string; oldVal: string; newVal: string }>;
}

export interface ColumnMapping {
  employee_code: string;
  full_name: string;
  email: string;
  department_name: string;
  job_title: string;
}

export type ConflictResolutionStrategy = "merge_update" | "skip_existing" | "overwrite";

export interface IngestionPreview {
  totalRows: number;
  validCount: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  rows: ParsedEmployeeRow[];
  detectedColumns: string[];
  columnMapping: ColumnMapping;
  distinctDepartments: string[];
}

export interface IngestionResult {
  success: boolean;
  totalProcessed: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  createdDepartmentsCount: number;
  errors: string[];
}

/**
 * Fuzzy matches spreadsheet header columns to standard employee fields
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => ({
    original: h,
    clean: h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  }));

  const findBest = (patterns: string[]): string => {
    for (const pattern of patterns) {
      const match = normalized.find(
        (n) => n.clean === pattern || n.clean.includes(pattern),
      );
      if (match) return match.original;
    }
    return "";
  };

  return {
    employee_code: findBest([
      "employeecode",
      "employeeid",
      "empid",
      "empcode",
      "staffid",
      "badgenumber",
      "idbadge",
      "id",
      "code",
    ]),
    full_name: findBest([
      "fullname",
      "employeename",
      "staffname",
      "name",
      "personname",
      "employee",
    ]),
    email: findBest(["workemail", "email", "emailaddress", "mail", "contactemail"]),
    department_name: findBest(["department", "dept", "division", "unit", "team", "section"]),
    job_title: findBest([
      "jobtitle",
      "title",
      "role",
      "position",
      "designation",
      "phone",
      "contact",
      "phonecontact",
    ]),
  };
}

/**
 * Robust RFC 4180 CSV / TSV text parser that handles quotes, commas, tabs, and multiline values
 */
export function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Detect delimiter (comma, tab, semicolon)
  const firstLine = text.split(/\r?\n/)[0] || "";
  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((val) => val.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((val) => val.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0 || !lines[0]) {
    return { headers: [], rows: [] };
  }

  // Remove potential UTF-8 BOM from the first header
  const headers = lines[0].map((h, idx) => (idx === 0 ? h.replace(/^\uFEFF/, "").trim() : h.trim()));
  const dataRows: Record<string, string>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const rowValues = lines[r];
    if (!rowValues) continue;
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = rowValues[idx] || "";
    });
    dataRows.push(rowObj);
  }

  return { headers, rows: dataRows };
}

/**
 * Parses uploaded spreadsheet file (CSV, TSV, or XLSX/XLS if supported)
 */
export async function parseRosterFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const fileName = file.name.toLowerCase();

  // If XLSX / XLS and xlsx library is available in window or dynamic import
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return { headers: [], rows: [] };
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) return { headers: [], rows: [] };
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1, defval: "" });

      if (jsonData.length === 0) return { headers: [], rows: [] };

      const headers = (jsonData[0] as any[]).map((h) => String(h || "").trim()).filter(Boolean);
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const rowArr = jsonData[i] as any[];
        if (!rowArr || rowArr.length === 0 || rowArr.every((c) => !c)) continue;
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = String(rowArr[idx] ?? "").trim();
        });
        rows.push(rowObj);
      }

      return { headers, rows };
    } catch (e) {
      console.warn("XLSX parser fallback to text reader:", e);
    }
  }

  // Fallback to text parsing (works for CSV, TSV, text exports)
  const text = await file.text();
  return parseDelimitedText(text);
}

/**
 * Performs conflict checking against live Supabase employee and department records
 */
export async function reconcileRosterWithDatabase(
  rawRows: Record<string, string>[],
  columnMapping: ColumnMapping,
  organizationId?: string,
): Promise<IngestionPreview> {
  // Fetch existing employees & departments scoped to company
  let empQuery = supabase
    .from("employees")
    .select("id,employee_code,full_name,email,job_title,department_id,departments(name)");
  if (organizationId) {
    empQuery = empQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
  }

  let deptQuery = supabase.from("departments").select("id,name");
  if (organizationId) {
    deptQuery = deptQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
  }

  const [{ data: existingEmployees }, { data: existingDepts }] = await Promise.all([
    empQuery,
    deptQuery,
  ]);

  const empCodeMap = new Map<string, any>();
  const empEmailMap = new Map<string, any>();
  (existingEmployees ?? []).forEach((e) => {
    if (e.employee_code) empCodeMap.set(e.employee_code.toLowerCase().trim(), e);
    if (e.email) empEmailMap.set(e.email.toLowerCase().trim(), e);
  });

  const parsedRows: ParsedEmployeeRow[] = [];
  const seenCodes = new Set<string>();
  const deptSet = new Set<string>();

  rawRows.forEach((row, index) => {
    const rawCode = (row[columnMapping.employee_code] || "").trim();
    const rawName = (row[columnMapping.full_name] || "").trim();
    const rawEmail = (row[columnMapping.email] || "").trim();
    const rawDept = (row[columnMapping.department_name] || "").trim();
    const rawTitle = (row[columnMapping.job_title] || "").trim();

    if (rawDept) deptSet.add(rawDept);

    const validationErrors: string[] = [];

    if (!rawCode) {
      validationErrors.push("Missing Employee ID/Code");
    } else if (rawCode.length > 32) {
      validationErrors.push("Employee ID exceeds 32 characters");
    }

    if (!rawName) {
      validationErrors.push("Missing Full Name");
    } else if (rawName.length < 2) {
      validationErrors.push("Name too short (< 2 characters)");
    }

    if (rawEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawEmail)) {
        validationErrors.push("Invalid Email format");
      }
    }

    // Check for in-file duplicates
    const codeKey = rawCode.toLowerCase();
    if (codeKey) {
      if (seenCodes.has(codeKey)) {
        validationErrors.push(`Duplicate ID '${rawCode}' in uploaded file`);
      } else {
        seenCodes.add(codeKey);
      }
    }

    // Conflict Check with Existing DB
    let conflictStatus: "new" | "update" | "invalid" = "new";
    let existingMatch = empCodeMap.get(codeKey);
    if (!existingMatch && rawEmail) {
      existingMatch = empEmailMap.get(rawEmail.toLowerCase());
    }

    const diffs: Array<{ field: string; oldVal: string; newVal: string }> = [];

    if (validationErrors.length > 0) {
      conflictStatus = "invalid";
    } else if (existingMatch) {
      conflictStatus = "update";
      const oldDept = (existingMatch.departments as { name: string } | null)?.name || "";
      if (existingMatch.full_name !== rawName) {
        diffs.push({ field: "Name", oldVal: existingMatch.full_name, newVal: rawName });
      }
      if (rawEmail && existingMatch.email !== rawEmail) {
        diffs.push({ field: "Email", oldVal: existingMatch.email || "None", newVal: rawEmail });
      }
      if (rawDept && oldDept !== rawDept) {
        diffs.push({ field: "Department", oldVal: oldDept || "Unassigned", newVal: rawDept });
      }
      if (rawTitle && existingMatch.job_title !== rawTitle) {
        diffs.push({ field: "Title/Contact", oldVal: existingMatch.job_title || "None", newVal: rawTitle });
      }
    }

    parsedRows.push({
      rowIndex: index + 1,
      employee_code: rawCode,
      full_name: rawName,
      email: rawEmail || null,
      department_name: rawDept || null,
      job_title: rawTitle || null,
      status: "active",
      rawRow: row,
      validationErrors,
      conflictStatus,
      existingEmployeeId: existingMatch?.id,
      diffs,
    });
  });

  const validRows = parsedRows.filter((r) => r.conflictStatus !== "invalid");
  const newRows = parsedRows.filter((r) => r.conflictStatus === "new");
  const updateRows = parsedRows.filter((r) => r.conflictStatus === "update");
  const errorRows = parsedRows.filter((r) => r.conflictStatus === "invalid");

  return {
    totalRows: parsedRows.length,
    validCount: validRows.length,
    newCount: newRows.length,
    updateCount: updateRows.length,
    errorCount: errorRows.length,
    rows: parsedRows,
    detectedColumns: Object.keys(rawRows[0] || {}),
    columnMapping,
    distinctDepartments: Array.from(deptSet),
  };
}

/**
 * Commits the bulk roster import into Supabase with safe department creation and conflict handling
 */
export async function executeBulkRosterIngestion(
  rows: ParsedEmployeeRow[],
  strategy: ConflictResolutionStrategy = "merge_update",
  organizationId?: string,
): Promise<IngestionResult> {
  const result: IngestionResult = {
    success: true,
    totalProcessed: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    createdDepartmentsCount: 0,
    errors: [],
  };

  try {
    // 1. Gather all department names and ensure they exist in Supabase
    const deptNames = Array.from(
      new Set(
        rows
          .map((r) => r.department_name)
          .filter((d): d is string => Boolean(d && d.trim().length > 0)),
      ),
    );

    let deptQuery = supabase.from("departments").select("id, name");
    if (organizationId) {
      deptQuery = deptQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }
    const { data: existingDepts, error: deptFetchErr } = await deptQuery;

    if (deptFetchErr) throw deptFetchErr;

    const deptMap = new Map<string, string>();
    (existingDepts || []).forEach((d) => deptMap.set(d.name.toLowerCase().trim(), d.id));

    // Find missing departments
    const missingDeptNames = deptNames.filter((name) => !deptMap.has(name.toLowerCase().trim()));

    if (missingDeptNames.length > 0) {
      const deptsToInsert = missingDeptNames.map((name) => ({
        name: name.trim(),
        organization_id: organizationId || null,
      }));
      const { data: insertedDepts, error: insertDeptErr } = await supabase
        .from("departments")
        .insert(deptsToInsert)
        .select("id, name");

      if (insertDeptErr) {
        console.warn("Department bulk insert warning:", insertDeptErr);
      } else if (insertedDepts) {
        insertedDepts.forEach((d) => deptMap.set(d.name.toLowerCase().trim(), d.id));
        result.createdDepartmentsCount = insertedDepts.length;
      }
    }

    // 2. Process Employee Inserts & Updates
    const toInsert: any[] = [];
    const toUpdate: ParsedEmployeeRow[] = [];

    for (const row of rows) {
      if (row.conflictStatus === "invalid") {
        continue;
      }

      const deptId = row.department_name
        ? deptMap.get(row.department_name.toLowerCase().trim()) || null
        : null;

      if (row.conflictStatus === "new") {
        toInsert.push({
          organization_id: organizationId || null,
          employee_code: row.employee_code,
          full_name: row.full_name,
          email: row.email || null,
          job_title: row.job_title || null,
          department_id: deptId,
          status: "active",
        });
      } else if (row.conflictStatus === "update") {
        if (strategy === "skip_existing") {
          result.skippedCount++;
        } else {
          toUpdate.push(row);
        }
      }
    }

    // 3. Batch Insert New Employees
    if (toInsert.length > 0) {
      // Chunk into batches of 50
      const chunkSize = 50;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error: insertErr } = await supabase.from("employees").insert(chunk);
        if (insertErr) {
          result.errors.push(`Insert batch error: ${insertErr.message}`);
        } else {
          result.insertedCount += chunk.length;
        }
      }
    }

    // 4. Update Existing Employees (if merge_update or overwrite)
    if (toUpdate.length > 0 && strategy !== "skip_existing") {
      for (const row of toUpdate) {
        if (!row.existingEmployeeId) continue;
        const deptId = row.department_name
          ? deptMap.get(row.department_name.toLowerCase().trim()) || null
          : null;

        const { error: updateErr } = await supabase
          .from("employees")
          .update({
            full_name: row.full_name,
            email: row.email || null,
            job_title: row.job_title || null,
            department_id: deptId,
          })
          .eq("id", row.existingEmployeeId);

        if (updateErr) {
          result.errors.push(`Update error for ${row.employee_code}: ${updateErr.message}`);
        } else {
          result.updatedCount++;
        }
      }
    }

    result.totalProcessed = result.insertedCount + result.updatedCount + result.skippedCount;
    result.success = result.errors.length === 0;
  } catch (error) {
    result.success = false;
    result.errors.push((error as Error).message);
  }

  return result;
}
