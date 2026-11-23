/* Anonymous browser-only performance diagnostics. No employee IDs,
 * request payloads, URLs with query params, or credentials are stored.
 * Open ?perf=1 on the app to inspect and export local measurements.
 * Vercel Speed Insights (when enabled) provides fleet-wide Core Web Vitals.
 */
const KEY = "magnemite.frontend.performance.v1";
const MAX_SAMPLES = 120;
const t0 = typeof performance !== "undefined" ? performance.now() : 0;

function sanitizeMetric(name) {
  return String(name || "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 65);
}

export function recordFrontendTiming(name, durationMs, status = "observed") {
  if (typeof window === "undefined" || !Number.isFinite(durationMs) || durationMs < 0) return;
  const metric = {
    at: new Date().toISOString(),
    metric: sanitizeMetric(name),
    milliseconds: Math.round(durationMs * 10) / 10,
    status: sanitizeMetric(status),
    version: "frontend-metrics-v1",
  };
  try {
    const existing = JSON.parse(localStorage.getItem(KEY) || "[]");
    const recent = Array.isArray(existing) ? existing.slice(-(MAX_SAMPLES - 1)) : [];
    recent.push(metric);
    localStorage.setItem(KEY, JSON.stringify(recent));
  } catch {
    // Private browsing or quota exhaustion must never block the application.
  }
  window.dispatchEvent(new Event("magnemite:timing"));
}

export function measureAppMount() {
  recordFrontendTiming("react_first_mount", performance.now() - t0);
}

function resourceName(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".supabase.co")) return null;
    const path = parsed.pathname;
    const match = path.match(/^\/(?:rest\/v1|auth\/v1)\/([^/?]+)/);
    return match ? "supabase_" + sanitizeMetric(match[1]) : "supabase_other";
  } catch { return null; }
}

export function startFrontendPerformance() {
  if (typeof window === "undefined" || !window.performance || window.__magnemitePerformanceStarted) return;
  window.__magnemitePerformanceStarted = true;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "largest-contentful-paint") {
          window.__magnemiteLastLcp = entry.startTime;
        }
        if (entry.entryType === "resource" && entry.initiatorType === "fetch") {
          const metric = resourceName(entry.name);
          // Sample at most one in ten resource responses to reduce browser overhead.
          if (metric && Math.random() < 0.1) recordFrontendTiming(metric, entry.duration);
        }
      }
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
    observer.observe({ type: "resource", buffered: true });
  } catch { /* Unsupported browser: no impact on app */ }

  const onLoad = () => {
    try {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav) {
        recordFrontendTiming("document_response", nav.responseEnd - nav.startTime);
        recordFrontendTiming("dom_content_loaded", nav.domContentLoadedEventEnd - nav.startTime);
        recordFrontendTiming("window_load", nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : performance.now());
      }
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      if (fcp) recordFrontendTiming("first_contentful_paint", fcp.startTime);
    } catch { /* optional diagnostics */ }
    window.setTimeout(() => {
      if (Number.isFinite(window.__magnemiteLastLcp)) {
        recordFrontendTiming("largest_contentful_paint", window.__magnemiteLastLcp);
      }
    }, 2500);
  };
  if (document.readyState === "complete") onLoad();
  else window.addEventListener("load", onLoad, { once: true });

  // Diagnostics intentionally opt-in: no performance overlay for employees.
  if (new URLSearchParams(window.location.search).get("perf") === "1") {
    const createPanel = () => {
      if (document.getElementById("magnemite-perf-panel")) return;
      const panel = document.createElement("aside");
      panel.id = "magnemite-perf-panel";
      panel.setAttribute("aria-label", "Local browser performance diagnostics");
      Object.assign(panel.style, {
        position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483647",
        width:"min(400px,calc(100vw - 24px))",maxHeight:"45vh",overflow:"auto",
        padding:"12px",borderRadius:"12px",border:"1px solid #94a3b8",
        background:"#fff",color:"#0f172a",font:"12px Arial,sans-serif",
        boxShadow:"0 8px 30px #0003"
      });
      const heading = document.createElement("strong");
      heading.textContent = "Magnemite — frontend timing (this browser)";
      const pre = document.createElement("pre");
      pre.style.whiteSpace = "pre-wrap";
      pre.style.marginBottom = "8px";
      const download = document.createElement("button");
      download.textContent = "Export timing CSV";
      download.type = "button";
      download.addEventListener("click", () => {
        let rows = [];
        try { rows = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
        const csv = ["timestamp,metric,milliseconds,status,version",...rows.map(r=>
          [r.at,r.metric,r.milliseconds,r.status,r.version].map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")
        )].join("\r\n");
        const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
        const anchor = document.createElement("a");
        anchor.href=url; anchor.download="magnemite-frontend-timings.csv";
        anchor.click();URL.revokeObjectURL(url);
      });
      panel.append(heading,pre,download);
      document.body.appendChild(panel);
      const update=()=>{
        let rows=[];try { rows=JSON.parse(localStorage.getItem(KEY)||"[]"); } catch {}
        const groups=new Map();
        for(const r of rows){const group=groups.get(r.metric)||[];group.push(r.milliseconds);groups.set(r.metric,group);}
        const summary=[...groups].map(([key,values])=>{
          const sorted=values.sort((a,b)=>a-b);
          const avg=Math.round(sorted.reduce((a,b)=>a+b,0)/sorted.length);
          const p95=Math.round(sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]);
          return key+": avg "+avg+"ms, p95 "+p95+"ms (n="+sorted.length+")";
        });
        pre.textContent=summary.join("\n")||"Collecting browser measurements…";
      };
      update();
      window.addEventListener("magnemite:timing",update);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",createPanel,{once:true});
    else createPanel();
  }
}
