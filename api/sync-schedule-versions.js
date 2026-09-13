import { createClient } from "@supabase/supabase-js";

const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanTime(value) {
  const raw = cleanText(value);

  if (
    !raw ||
    raw.toLowerCase() === "null" ||
    raw.toLowerCase() === "not available"
  ) {
    return null;
  }

  const match = raw.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (!match) {
    return null;
  }

  return `${String(
    Number(match[1])
  ).padStart(2, "0")}:${match[2]}`;
}

function normalizeDay(value) {
  const raw = cleanText(value).toLowerCase();

  return (
    WEEK_DAYS.find(
      (day) =>
        day.toLowerCase() === raw ||
        day
          .slice(0, 3)
          .toLowerCase() ===
          raw.slice(0, 3)
    ) || ""
  );
}

function normalizeOffDays(value) {
  const values = Array.isArray(value)
    ? value
    : cleanText(value)
        .split(/[,|;]/)
        .map((item) => item.trim());

  return WEEK_DAYS.filter((day) =>
    values.some(
      (valueDay) =>
        normalizeDay(valueDay) === day
    )
  ).join(", ");
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  const raw = cleanText(value).toLowerCase();

  if (
    [
      "false",
      "no",
      "off",
      "0",
      "inactive",
    ].includes(raw)
  ) {
    return false;
  }

  return true;
}

function normalizeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function previousDate(dateKey) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  date.setUTCDate(
    date.getUTCDate() - 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function getCostaRicaDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function normalizeIncomingRow(
  row,
  effectiveDate
) {
  const employeeId = cleanText(
    row?.employee_id
  );

  const dayName = normalizeDay(
    row?.day_name
  );

  if (!employeeId || !dayName) {
    return null;
  }

  const isScheduled =
    normalizeBoolean(
      row?.is_scheduled
    );

  return {
    employee_id: employeeId,

    employee_name:
      cleanText(
        row?.employee_name
      ) || null,

    day_name: dayName,

    lob:
      cleanText(row?.lob) ||
      null,

    department:
      cleanText(
        row?.department
      ) || null,

    supervisor:
      cleanText(
        row?.supervisor
      ) || null,

    /*
      Schedule times are stored in the
      App_Schedules source timezone (EST/ET).

      Employee-local conversion remains handled
      by getStableSchedule() in App.jsx.
    */
    shift_start: isScheduled
      ? cleanTime(
          row?.shift_start
        )
      : null,

    shift_end: isScheduled
      ? cleanTime(
          row?.shift_end
        )
      : null,

    is_scheduled:
      isScheduled,

    off_days:
      normalizeOffDays(
        row?.off_days
      ) || null,

    lunch_start:
      cleanTime(
        row?.lunch_start
      ),

    lunch_end:
      cleanTime(
        row?.lunch_end
      ),

    break_1_start:
      cleanTime(
        row?.break_1_start
      ),

    break_1_end:
      cleanTime(
        row?.break_1_end
      ),

    break_2_start:
      cleanTime(
        row?.break_2_start
      ),

    break_2_end:
      cleanTime(
        row?.break_2_end
      ),

    expected_productive_hours:
      normalizeNumber(
        row?.expected_productive_hours
      ),

    effective_from:
      effectiveDate,

    effective_to:
      null,

    source_schedule_key:
      cleanText(
        row?.source_schedule_key
      ) ||
      `${employeeId}_${dayName}`,

    source:
      cleanText(row?.source) ||
      "Google Sheets: App_Schedules",

    source_synced_at:
      new Date().toISOString(),

    updated_at:
      new Date().toISOString(),
  };
}

/*
  Only these values determine whether we have
  an actual schedule change.

  Metadata changes such as supervisor or LOB
  must NOT create a new historical schedule
  version unnecessarily.
*/
function scheduleSignature(row) {
  return JSON.stringify({
    shift_start:
      cleanTime(
        row?.shift_start
      ),

    shift_end:
      cleanTime(
        row?.shift_end
      ),

    is_scheduled:
      normalizeBoolean(
        row?.is_scheduled
      ),

    off_days:
      normalizeOffDays(
        row?.off_days
      ),
  });
}

export default async function handler(
  request,
  response
) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed.",
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return response.status(500).json({
      error:
        "Server-side Supabase credentials are not configured.",
    });
  }

  /*
    Keep the same sync-token pattern currently
    used by the schedule-exception endpoint.

    NOTE:
    VITE_ variables are browser-visible, so this
    token should not be treated as the primary
    security boundary. The server-side service
    role key remains private.
  */
  const configuredSecret =
    process.env
      .SCHEDULE_SYNC_SECRET ||
    "";

  const suppliedSecret =
    cleanText(
      request.headers[
        "x-sync-secret"
      ]
    );

  if (
    configuredSecret &&
    suppliedSecret !==
      configuredSecret
  ) {
    return response.status(401).json({
      error:
        "Invalid schedule sync token.",
    });
  }

  const incomingRows =
    Array.isArray(
      request.body?.rows
    )
      ? request.body.rows
      : [];

  const requestedEffectiveDate =
    cleanText(
      request.body?.effectiveDate
    );

  const effectiveDate =
    /^\d{4}-\d{2}-\d{2}$/.test(
      requestedEffectiveDate
    )
      ? requestedEffectiveDate
      : getCostaRicaDate();

  /*
    Deduplicate employee/day combinations before
    touching the database.

    Last row wins if a duplicate somehow arrives.
  */
  const normalizedMap =
    new Map();

  incomingRows.forEach(
    (incomingRow) => {
      const normalized =
        normalizeIncomingRow(
          incomingRow,
          effectiveDate
        );

      if (!normalized) {
        return;
      }

      const key =
        `${normalized.employee_id}|` +
        `${normalized.day_name}`;

      normalizedMap.set(
        key,
        normalized
      );
    }
  );

  const rows =
    Array.from(
      normalizedMap.values()
    );

  if (!rows.length) {
    return response.status(200).json({
      success: true,
      receivedCount: 0,
      changedCount: 0,
      insertedCount: 0,
      sameDayUpdatedCount: 0,
      closedCount: 0,
      unchangedCount: 0,
    });
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  try {
    const employeeIds = [
      ...new Set(
        rows.map(
          (row) =>
            row.employee_id
        )
      ),
    ];

    /*
      Load every currently-open schedule version
      in one query.

      This avoids hundreds of individual database
      reads and keeps Sync Roster fast.
    */
    const {
      data: openVersions,
      error: openError,
    } = await supabase
      .from(
        "employee_schedule_versions"
      )
      .select("*")
      .in(
        "employee_id",
        employeeIds
      )
      .is(
        "effective_to",
        null
      );

    if (openError) {
      throw openError;
    }

    const currentByKey =
      new Map();

    const duplicateOpenKeys =
      [];

    (
      openVersions || []
    )
      .sort((a, b) =>
        String(
          a?.effective_from || ""
        ).localeCompare(
          String(
            b?.effective_from || ""
          )
        )
      )
      .forEach((version) => {
        const key =
          `${cleanText(
            version.employee_id
          )}|${normalizeDay(
            version.day_name
          )}`;

        if (
          currentByKey.has(key)
        ) {
          duplicateOpenKeys.push(
            key
          );
        }

        /*
          Sorted oldest → newest, so the
          latest open version wins.
        */
        currentByKey.set(
          key,
          version
        );
      });

    const rowsToInsert = [];
    const sameDayUpdates = [];
    const idsToClose = [];

    let unchangedCount = 0;

    for (const row of rows) {
      const key =
        `${row.employee_id}|` +
        `${row.day_name}`;

      const current =
        currentByKey.get(key);

      /*
        No current version:
        create the initial/current version.
      */
      if (!current) {
        rowsToInsert.push(row);
        continue;
      }

      const currentFrom =
        cleanText(
          current.effective_from
        );

      /*
        Safety rule:
        never rewrite history backwards.
      */
      if (
        currentFrom &&
        currentFrom >
          effectiveDate
      ) {
        return response
          .status(409)
          .json({
            error:
              "A schedule version exists with an effective date later than the requested sync date.",
            employee_id:
              row.employee_id,
            day_name:
              row.day_name,
            existing_effective_from:
              currentFrom,
            requested_effective_from:
              effectiveDate,
          });
      }

      const scheduleChanged =
        scheduleSignature(
          current
        ) !==
        scheduleSignature(
          row
        );

      if (!scheduleChanged) {
        unchangedCount += 1;
        continue;
      }

      /*
        If schedule changes again on the SAME
        effective date, update that day's version.

        Date-level history cannot represent two
        separate versions on one calendar date,
        so this prevents duplicates.
      */
      if (
        currentFrom ===
        effectiveDate
      ) {
        sameDayUpdates.push({
          ...row,
          id: current.id,
        });

        continue;
      }

      /*
        Older open version:
        close it yesterday and insert the new
        version effective today.
      */
      idsToClose.push(
        current.id
      );

      rowsToInsert.push(
        row
      );
    }

    const closeDate =
      previousDate(
        effectiveDate
      );

    /*
      Close changed historical versions in
      one database operation.
    */
    if (idsToClose.length) {
      const {
        error: closeError,
      } = await supabase
        .from(
          "employee_schedule_versions"
        )
        .update({
          effective_to:
            closeDate,

          updated_at:
            new Date()
              .toISOString(),
        })
        .in(
          "id",
          idsToClose
        );

      if (closeError) {
        throw closeError;
      }
    }

    /*
      A second sync on the same date updates
      today's existing version rather than
      creating another version.
    */
    if (
      sameDayUpdates.length
    ) {
      const {
        error:
          sameDayUpdateError,
      } = await supabase
        .from(
          "employee_schedule_versions"
        )
        .upsert(
          sameDayUpdates,
          {
            onConflict: "id",
          }
        );

      if (
        sameDayUpdateError
      ) {
        throw sameDayUpdateError;
      }
    }

    /*
      Insert all genuinely-new versions as
      one batch for performance.
    */
    if (rowsToInsert.length) {
      const {
        error: insertError,
      } = await supabase
        .from(
          "employee_schedule_versions"
        )
        .insert(
          rowsToInsert
        );

      if (insertError) {
        throw insertError;
      }
    }

    return response
      .status(200)
      .json({
        success: true,

        effectiveDate,

        receivedCount:
          rows.length,

        insertedCount:
          rowsToInsert.length,

        sameDayUpdatedCount:
          sameDayUpdates.length,

        closedCount:
          idsToClose.length,

        unchangedCount,

        changedCount:
          rowsToInsert.length +
          sameDayUpdates.length,

        duplicateOpenKeys:
          [
            ...new Set(
              duplicateOpenKeys
            ),
          ],
      });
  } catch (error) {
    console.error(
      "Schedule version sync failed:",
      error
    );

    return response
      .status(500)
      .json({
        error:
          error?.message ||
          "Schedule version synchronization failed.",
      });
  }
}