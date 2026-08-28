const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAYROLL_REVIEW_API_ENABLED =
  process.env.PAYROLL_REVIEW_API_ENABLED === "true";

async function supabaseRequest(
  table,
  {
    method = "GET",
    query = "",
    body = null,
  } = {}
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

  const response = await fetch(url, {
    method,
    headers: {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  ...(method === "POST"
    ? { Prefer: "return=representation" }
    : {}),
},

    body:
      body === null
        ? undefined
        : JSON.stringify(body),
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
      `Supabase ${method} ${table} failed:`,
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

export default async function handler(
  req,
  res
) {
  /*
    Development safety switch.

    Leave this disabled in deployments
    until the Payroll workflow is ready
    for production.
  */
  const requestHost =
  String(req.headers.host || "")
    .toLowerCase();

const isLocalRequest =
  requestHost.startsWith("localhost:") ||
  requestHost.startsWith("127.0.0.1:");

if (
  !isLocalRequest &&
  !PAYROLL_REVIEW_API_ENABLED
) {
  return res.status(503).json({
    success: false,
    error:
      "Payroll Review API is disabled.",
  });
}

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      success: false,
      error:
        "Method not allowed.",
    });
  }

  try {
    const {
      period_start,
      period_end,

      scope_type = "ALL",
      scope_filters = {},

      employee_count = 0,

      requested_by_name = "",
      requested_by_email = "",
      actor_role = "",

      reviewer_emails = [],
    } = req.body || {};

    if (
      !period_start ||
      !period_end
    ) {
      return res.status(400).json({
        success: false,
        error:
          "period_start and period_end are required.",
      });
    }

    if (!requested_by_email) {
      return res.status(400).json({
        success: false,
        error:
          "requested_by_email is required.",
      });
    }

    if (
      !Array.isArray(
        reviewer_emails
      ) ||
      reviewer_emails.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "At least one reviewer is required.",
      });
    }

    const now =
      new Date().toISOString();

    /*
      STEP 1:
      Create the permanent Payroll
      review record.
    */
    const reviewRows =
      await supabaseRequest(
        "payroll_reviews",
        {
          method: "POST",

          body: {
            period_start,
            period_end,

            scope_type,

            scope_filters,

            status:
              "SENT_FOR_REVIEW",

            employee_count:
              Number(
                employee_count
              ) || 0,

            requested_by_name:
              requested_by_name ||
              requested_by_email,

            requested_by_email,

            sent_for_review_at:
              now,

            updated_at:
              now,
          },
        }
      );

    const payrollReview =
      Array.isArray(reviewRows)
        ? reviewRows[0]
        : reviewRows;

    if (!payrollReview?.id) {
      throw new Error(
        "Payroll review was created but no review ID was returned."
      );
    }

   /*
  STEP 2:
  Save the reviewers assigned to this Payroll Review.
*/
try {
  const uniqueReviewerEmails = [
    ...new Set(
      reviewer_emails
        .map((email) =>
          String(email || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    ),
  ];

  await supabaseRequest(
    "payroll_review_reviewers",
    {
      method: "POST",

      body: uniqueReviewerEmails.map(
        (email) => ({
          payroll_review_id:
            payrollReview.id,

          reviewer_name: null,

          reviewer_email:
            email,

          reviewer_role: null,

          review_status:
            "PENDING",
        })
      ),
    }
  );

  /*
    STEP 3:
    Create the audit-history entry.
  */
      const actionRows =
        await supabaseRequest(
          "payroll_review_actions",
          {
            method: "POST",

            body: {
              payroll_review_id:
                payrollReview.id,

              actor_name:
                requested_by_name ||
                requested_by_email,

              actor_email:
                requested_by_email,

              actor_role:
                actor_role || null,

              action:
                "SENT_FOR_REVIEW",

              comments:
                `Sent for review to: ${reviewer_emails.join(
                  ", "
                )}`,
            },
          }
        );

      const reviewAction =
        Array.isArray(actionRows)
          ? actionRows[0]
          : actionRows;

      return res.status(200).json({
        success: true,

        payroll_review_id:
          payrollReview.id,

        review:
          payrollReview,

        action:
          reviewAction,
      });
    } catch (workflowError) {
      /*
        Basic rollback:
        If the audit action cannot be
        created, remove the incomplete
        parent review record.
      */
      try {
        await supabaseRequest(
          "payroll_reviews",
          {
            method: "DELETE",
            query:
              `id=eq.${encodeURIComponent(
                payrollReview.id
              )}`,
          }
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Payroll review rollback failed:",
          rollbackError
        );
      }

      throw workflowError;
    }
  } catch (error) {
    console.error(
      "Payroll Review API error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unable to create Payroll review.",
    });
  }
}