const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPLICATION_USAGE_API_ENABLED =
  process.env.APPLICATION_USAGE_API_ENABLED ===
  "true";

  console.log(
  "Application Usage enabled setting:",
  JSON.stringify(process.env.APPLICATION_USAGE_API_ENABLED)
);

const APPLICATION_USAGE_ACCESS_TOKEN =
  String(
    process.env
      .APPLICATION_USAGE_ACCESS_TOKEN ||
      ""
  ).trim();

const APPLICATION_USAGE_ALLOWED_EMAILS =
  new Set(
    String(
      process.env
        .APPLICATION_USAGE_ALLOWED_EMAILS ||
        ""
    )
      .split(",")
      .map((email) =>
        email.trim().toLowerCase()
      )
      .filter(Boolean)
  );

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || "")
  );
}

function resolveLimit(value) {
  const requested = Number(value);

  if (!Number.isFinite(requested)) {
    return 100;
  }

  return Math.min(
    200,
    Math.max(
      1,
      Math.floor(requested)
    )
  );
}

async function supabaseRequest(
  table,
  query = ""
) {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    (query ? `?${query}` : "");

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        apikey:
          SUPABASE_SERVICE_ROLE_KEY,

        Authorization:
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

        "Content-Type":
          "application/json",
      },
    });

  const responseText =
    await response.text();

  let responseData = null;

  if (responseText) {
    try {
      responseData =
        JSON.parse(responseText);
    } catch {
      responseData =
        responseText;
    }
  }

  if (!response.ok) {
    console.error(
      `Application Usage Supabase request failed:`,
      responseData
    );

    throw new Error(
      responseData?.message ||
      responseData?.error ||
      responseText ||
      `Supabase request failed with ${response.status}.`
    );
  }

  return responseData;
}


async function loadUsageSummary(startDate, endDate) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase server configuration is missing.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_app_usage_summary`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_start_date: startDate,
        p_end_date: endDate,
      }),
    }
  );

    if (!response.ok) {
    const errorText = await response.text();

    let errorDetails;

    try {
      const parsed = JSON.parse(errorText);

      errorDetails = {
        code: parsed.code,
        message: parsed.message,
        details: parsed.details,
        hint: parsed.hint,
      };
    } catch {
      errorDetails = {
        message: errorText.slice(0, 500),
      };
    }

    console.error(
      "Application Usage summary request failed:",
      {
        status: response.status,
        ...errorDetails,
      }
    );

    throw new Error(
      "Unable to calculate the full-period activity summary."
    );
  }

  const result = await response.json();

  return Array.isArray(result)
    ? result[0] || null
    : result;
}


/*
 * MAGNEMITE — PRIVATE APPLICATION USAGE CSV EXPORT
 *
 * CSV formatting helpers.
 * The protected API will retrieve the complete selected
 * reporting period before generating the export.
 */

const USAGE_CSV_COLUMNS = [
  ["Activity Date", "activity_date"],
  ["Date / Time", "activity_datetime"],
  ["User", "actor_name"],
  ["User Email", "actor_email"],
  ["Role", "actor_role"],
  ["Action", "action_type"],
  ["Action Category", "action_category"],
  ["Employee ID", "employee_id"],
  ["Affected Employee", "employee_name"],
  ["Records Affected", "records_affected"],
  ["Employees Affected", "employees_affected"],
  ["Decision", "decision"],
  ["Request Type", "request_type"],
  ["Time Category", "time_category"],
  ["Payable Status", "payable_status"],
  ["Self-Action Flag", "self_action_flag"],
  ["Source", "source"],
  ["Record ID", "id"],
  ["Created At UTC", "created_at_utc"],
];

function usageCsvCell(value) {
  const text = String(value ?? "");

  // Prevent imported text from being interpreted
  // as a spreadsheet formula.
  const safeText =
    /^[\s\uFEFF]*[=+\-@]/.test(text)
      ? "'" + text
      : text;

  return (
    '"' +
    safeText.replace(/"/g, '""') +
    '"'
  );
}

function buildUsageCsv(rows) {
  const header = USAGE_CSV_COLUMNS
    .map(([heading]) => usageCsvCell(heading))
    .join(",");

  const dataLines = rows.map((row) =>
    USAGE_CSV_COLUMNS
      .map(([, field]) => usageCsvCell(row[field]))
      .join(",")
  );

  // UTF-8 BOM helps Excel and WPS Office
  // recognize the file encoding correctly.
  return (
    "\uFEFF" +
    [header, ...dataLines].join("\r\n") +
    "\r\n"
  );
}


/*
 * Retrieve all activity records for a selected
 * reporting period in manageable batches.
 *
 * Runs on the protected server API, never directly
 * from the browser.
 */

async function loadAllUsageRows(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error(
      "Select a start date and end date before exporting."
    );
  }

  const BATCH_SIZE = 500;
  const MAX_EXPORT_ROWS = 20000;

  const allRows = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams();

    params.set(
      "select",
      [
        ...new Set(
          USAGE_CSV_COLUMNS.map(([, field]) => field)
        ),
      ].join(",")
    );

    // Use a consistent order across all batches.
    params.set(
      "order",
      "activity_datetime.desc,id.desc"
    );

    params.set(
      "activity_date",
      `gte.${startDate}`
    );

    params.append(
      "activity_date",
      `lte.${endDate}`
    );

    params.set(
      "limit",
      String(BATCH_SIZE)
    );

    params.set(
      "offset",
      String(offset)
    );

    const batch = await supabaseRequest(
      "v_app_usage_activity",
      params.toString()
    );

    if (!Array.isArray(batch)) {
      throw new Error(
        "Invalid activity data returned by Supabase."
      );
    }

    if (
      allRows.length + batch.length >
      MAX_EXPORT_ROWS
    ) {
      throw new Error(
        `This export exceeds ${MAX_EXPORT_ROWS} records. ` +
        "A larger export method is required."
      );
    }

    allRows.push(...batch);

    // A partially filled batch means we have
    // reached the end of the reporting period.
    if (batch.length < BATCH_SIZE) {
      break;
    }

    offset += BATCH_SIZE;
  }

  return allRows;
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  /*
    Fail closed.

    This endpoint is intentionally separate
    from normal Magnemite Manager/Admin access.
  */
  if (!APPLICATION_USAGE_API_ENABLED) {
    return res.status(503).json({
      success: false,
      error:
        "Application Usage API is disabled.",
    });
  }

  if (
    !APPLICATION_USAGE_ACCESS_TOKEN
  ) {
    return res.status(503).json({
      success: false,
      error:
        "Application Usage access token is not configured.",
    });
  }

  if (
    !APPLICATION_USAGE_ALLOWED_EMAILS.size
  ) {
    return res.status(503).json({
      success: false,
      error:
        "Application Usage allowed emails are not configured.",
    });
  }

  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res.status(405).json({
      success: false,
      error:
        "Method not allowed.",
    });
  }

  const developerEmail =
    normalizeEmail(
      req.headers[
        "x-developer-email"
      ]
    );

  const suppliedAccessToken =
    String(
      req.headers[
        "x-usage-access-token"
      ] || ""
    ).trim();

  /*
    Both conditions must pass:

    1. Email must be explicitly allowlisted.
    2. Developer must provide the private
       server-configured access token.

    Normal Magnemite roles do not grant access.
  */
  if (
    !developerEmail ||
    !APPLICATION_USAGE_ALLOWED_EMAILS.has(
      developerEmail
    )
  ) {
    return res.status(403).json({
      success: false,
      error:
        "Developer access is not authorized.",
    });
  }

  if (
    suppliedAccessToken !==
    APPLICATION_USAGE_ACCESS_TOKEN
  ) {
    return res.status(403).json({
      success: false,
      error:
        "Developer access is not authorized.",
    });
  }

  try {
    const startDate =
      String(
        req.query?.start_date || ""
      ).trim();

    const endDate =
      String(
        req.query?.end_date || ""
      ).trim();

    if (
      startDate &&
      !isValidDateKey(startDate)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid start_date.",
      });
    }

    if (
      endDate &&
      !isValidDateKey(endDate)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid end_date.",
      });
    }

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      return res.status(400).json({
        success: false,
        error:
          "start_date cannot be after end_date.",
      });
    }


    /*
     * PRIVATE CSV EXPORT
     *
     * Runs only after the existing developer
     * email and access-token checks succeed.
     *
     * Exports the complete selected period,
     * independently of dashboard pagination.
     */
    const requestedFormat = String(
      req.query?.format || ""
    )
      .trim()
      .toLowerCase();

    if (requestedFormat === "csv") {
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error:
            "Select a start date and end date before exporting CSV.",
        });
      }

      const exportRows =
        await loadAllUsageRows(
          startDate,
          endDate
        );

      const csvContent =
        buildUsageCsv(exportRows);

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Magnemite_Usage_${startDate}_to_${endDate}.csv"`
      );

      res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
      );

      return res
        .status(200)
        .send(csvContent);
    }

        const limit =
      resolveLimit(
        req.query?.limit
      );

    const requestedPage =
      Number(req.query?.page || 1);

    const page =
      Number.isFinite(requestedPage)
        ? Math.min(
            10000,
            Math.max(1, Math.floor(requestedPage))
          )
        : 1;

    const offset =
      (page - 1) * limit;

    const params =
      new URLSearchParams();

    params.set(
      "select",
      [
        "id",
        "activity_date",
        "activity_datetime",
        "created_at_utc",
        "actor_email",
        "actor_name",
        "actor_role",
        "action_type",
        "action_category",
        "employee_id",
        "employee_name",
        "target_table",
        "target_record_id",
        "records_affected",
        "employees_affected",
        "decision",
        "request_type",
        "time_category",
        "payable_status",
        "self_action_flag",
        "source",
      ].join(",")
    );

    params.set(
      "order",
      "activity_datetime.desc"
    );

        params.set(
      "limit",
      String(limit + 1)
    );

    params.set(
      "offset",
      String(offset)
    );

    if (startDate) {
      params.append(
        "activity_date",
        `gte.${startDate}`
      );
    }

    if (endDate) {
      params.append(
        "activity_date",
        `lte.${endDate}`
      );
    }


    const rows =
      await supabaseRequest(
        "v_app_usage_activity",
        params.toString()
      );

    // Calculate totals for the entire selected period.
    const summary =
      startDate && endDate
        ? await loadUsageSummary(
            startDate,
            endDate
          )
        : null;

    // Return the detailed records and complete summary.
    return res
      .status(200)
      .json({
        success: true,

        summary,

        requested_by:
          developerEmail,

        generated_at:
          new Date().toISOString(),

                page,

        page_size: limit,

        row_count:
          Array.isArray(rows)
            ? Math.min(rows.length, limit)
            : 0,

        has_more:
          Array.isArray(rows)
            ? rows.length > limit
            : false,

        rows:
          Array.isArray(rows)
            ? rows.slice(0, limit)
            : [],
      });

  } catch (error) {
    console.error(
      "Application Usage API error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        error:
          error?.message ||
          "Unable to load application usage.",
      });
  }
}