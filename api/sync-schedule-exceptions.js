import { createClient } from "@supabase/supabase-js";

function normalizeRows(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (row) =>
      row &&
      typeof row === "object" &&
      String(row.exception_id || "").trim()
  );
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return response.status(500).json({
      success: false,
      error: "Server-side Supabase credentials are not configured.",
    });
  }

  const expectedSyncSecret = process.env.SCHEDULE_SYNC_SECRET;
  const suppliedSyncSecret = request.headers["x-sync-secret"];

  if (
    expectedSyncSecret &&
    suppliedSyncSecret !== expectedSyncSecret
  ) {
    return response.status(401).json({
      success: false,
      error: "Unauthorized schedule exception sync request.",
    });
  }

  try {
    const rows = normalizeRows(request.body?.rows);

    if (!rows.length) {
      return response.status(400).json({
        success: false,
        error: "No valid schedule exception rows were provided.",
      });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const uniqueRows = Array.from(
      new Map(
        rows.map((row) => [
          String(row.exception_id).trim(),
          {
            exception_id: String(row.exception_id).trim(),
            employee_id: String(row.employee_id || "").trim(),
            full_name: String(row.full_name || "").trim(),
            start_date: row.start_date || null,
            end_date: row.end_date || null,
            weekday: String(row.weekday || "").trim(),
            shift_start_est: String(row.shift_start_est || "").trim(),
            shift_end_est: String(row.shift_end_est || "").trim(),
            break_1_start_est: String(
              row.break_1_start_est || ""
            ).trim(),
            break_1_end_est: String(
              row.break_1_end_est || ""
            ).trim(),
            break_2_start_est: String(
              row.break_2_start_est || ""
            ).trim(),
            break_2_end_est: String(
              row.break_2_end_est || ""
            ).trim(),
            enabled: row.enabled !== false,
            priority: Number(row.priority) || 0,
            notes: String(row.notes || "").trim(),
            source:
              String(row.source || "").trim() ||
              "Schedule_Exceptions Google Sheet",
            updated_at: new Date().toISOString(),
          },
        ])
      ).values()
    );

    const { data, error } = await supabaseAdmin
      .from("schedule_exceptions")
      .upsert(uniqueRows, {
        onConflict: "exception_id",
      })
      .select();

    if (error) {
      throw error;
    }

    return response.status(200).json({
      success: true,
      syncedCount: data?.length || uniqueRows.length,
      rows: data || [],
    });
  } catch (error) {
    console.error("Schedule exception API sync failed:", error);

    return response.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to sync schedule exceptions.",
    });
  }
}