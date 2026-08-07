import fs from "node:fs/promises";
import path from "node:path";

const USERNAME = process.env.GH_USERNAME || "0xAeterNova";
const TOKEN = process.env.GH_TOKEN || "";
const OUTPUT_DIR = process.env.HEATMAP_OUTPUT_DIR || "assets/heatmap";
const placeholderMode = process.argv.includes("--placeholder");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateRange() {
  const to = new Date();
  to.setUTCHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 370);
  from.setUTCHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchCalendar() {
  if (!TOKEN) {
    throw new Error(
      "GH_TOKEN is missing. Add a PROFILE_TOKEN repository secret to include public and private contributions."
    );
  }

  const { from, to } = dateRange();
  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": `${USERNAME}-profile-heatmap`,
    },
    body: JSON.stringify({ query, variables: { login: USERNAME, from, to } }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub GraphQL request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(payload.errors)}`);
  }

  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(`No contribution calendar was returned for ${USERNAME}.`);
  }
  return calendar;
}

function placeholderCalendar() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 364 - start.getUTCDay());
  const weeks = [];
  let current = new Date(start);
  for (let w = 0; w < 53; w += 1) {
    const contributionDays = [];
    for (let d = 0; d < 7; d += 1) {
      contributionDays.push({ contributionCount: 0, date: isoDate(current), weekday: d });
      current.setUTCDate(current.getUTCDate() + 1);
    }
    weeks.push({ contributionDays });
  }
  return { totalContributions: 0, weeks, placeholder: true };
}

function levelFor(count, max) {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.15) return 1;
  if (ratio <= 0.35) return 2;
  if (ratio <= 0.65) return 3;
  return 4;
}

function renderSvg(calendar, theme) {
  const dark = theme === "dark";
  const colors = dark
    ? { bg: "#030712", panel: "#0F172A", text: "#F8FAFC", muted: "#94A3B8", grid: "#1E293B", levels: ["#172033", "#143B5B", "#166B7C", "#17A398", "#22D3EE"], accentA: "#7C3AED", accentB: "#22D3EE", accentC: "#10B981" }
    : { bg: "#FFFFFF", panel: "#F8FAFC", text: "#0F172A", muted: "#475569", grid: "#E2E8F0", levels: ["#E9EEF5", "#BAE6FD", "#67E8F9", "#22D3EE", "#0891B2"], accentA: "#2563EB", accentB: "#06B6D4", accentC: "#10B981" };

  const weeks = calendar.weeks.slice(-53);
  const allDays = weeks.flatMap((week) => week.contributionDays);
  const max = Math.max(0, ...allDays.map((day) => day.contributionCount));
  const cell = 13;
  const gap = 4;
  const left = 88;
  const top = 108;
  const width = 1040;
  const height = 255;

  const monthLabels = [];
  let previousMonth = -1;
  weeks.forEach((week, index) => {
    const first = week.contributionDays[0];
    if (!first) return;
    const month = new Date(`${first.date}T00:00:00Z`).getUTCMonth();
    if (month !== previousMonth) {
      monthLabels.push(`<text x="${left + index * (cell + gap)}" y="91" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" fill="${colors.muted}">${new Date(`${first.date}T00:00:00Z`).toLocaleString("en", { month: "short", timeZone: "UTC" })}</text>`);
      previousMonth = month;
    }
  });

  const cells = [];
  weeks.forEach((week, xIndex) => {
    week.contributionDays.forEach((day) => {
      const x = left + xIndex * (cell + gap);
      const y = top + day.weekday * (cell + gap);
      const level = levelFor(day.contributionCount, max);
      const delay = ((xIndex * 7 + day.weekday) * 0.009).toFixed(3);
      cells.push(`
        <g transform="translate(${x} ${y})">
          <rect width="${cell}" height="${cell}" rx="3" fill="${colors.levels[level]}" opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.26s" begin="${delay}s" fill="freeze"/>
            ${level > 0 ? `<animate attributeName="fill-opacity" values="0.72;1;0.72" dur="${(3.5 + level * 0.45).toFixed(2)}s" begin="-${delay}s" repeatCount="indefinite"/>` : ""}
          </rect>
          <title>${escapeXml(day.date)}: ${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"}</title>
        </g>`);
    });
  });

  const subtitle = calendar.placeholder
    ? "Awaiting the first automated GitHub Actions update"
    : `${calendar.totalContributions.toLocaleString("en-US")} contributions in the displayed period`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="330" viewBox="0 0 1180 330" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(USERNAME)} GitHub Jet Heatmap</title>
  <desc id="desc">Animated GitHub contribution heatmap that updates daily through GitHub Actions.</desc>
  <defs>
    <linearGradient id="jet" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.accentA}"/>
      <stop offset="0.5" stop-color="${colors.accentB}"/>
      <stop offset="1" stop-color="${colors.accentC}"/>
      <animate attributeName="x1" values="0;1;0" dur="7s" repeatCount="indefinite"/>
      <animate attributeName="x2" values="1;0;1" dur="7s" repeatCount="indefinite"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${colors.accentB}" stop-opacity="0.20"/><stop offset="1" stop-color="${colors.accentB}" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-opacity="0.18"/></filter>
  </defs>
  <rect width="1180" height="330" rx="28" fill="${colors.bg}"/>
  <circle cx="970" cy="40" r="230" fill="url(#glow)"><animate attributeName="cx" values="900;1040;900" dur="12s" repeatCount="indefinite"/></circle>
  <rect x="20" y="20" width="1140" height="290" rx="24" fill="${colors.panel}" stroke="url(#jet)" stroke-opacity="0.58" filter="url(#shadow)">
    <animate attributeName="stroke-opacity" values="0.3;0.9;0.3" dur="5s" repeatCount="indefinite"/>
  </rect>
  <text x="54" y="61" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="22" font-weight="800" fill="${colors.text}">GitHub Jet Heatmap</text>
  <text x="54" y="82" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" fill="${colors.muted}">${escapeXml(subtitle)}</text>
  ${monthLabels.join("\n")}
  <text x="53" y="121" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" fill="${colors.muted}">Mon</text>
  <text x="53" y="155" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" fill="${colors.muted}">Wed</text>
  <text x="53" y="189" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" fill="${colors.muted}">Fri</text>
  ${cells.join("\n")}
  <g transform="translate(870 278)" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" fill="${colors.muted}">
    <text x="0" y="11">Less</text>
    ${colors.levels.map((color, i) => `<rect x="${42 + i * 19}" y="0" width="13" height="13" rx="3" fill="${color}"/>`).join("")}
    <text x="145" y="11">More</text>
  </g>
  <path d="M54 270 H1126" stroke="${colors.grid}"/>
  <text x="54" y="294" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" fill="${colors.muted}">daily automation · public + private contributions when PROFILE_TOKEN is configured</text>
</svg>`;
}

async function main() {
  const calendar = placeholderMode ? placeholderCalendar() : await fetchCalendar();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(OUTPUT_DIR, "dark.svg"), renderSvg(calendar, "dark"), "utf8"),
    fs.writeFile(path.join(OUTPUT_DIR, "light.svg"), renderSvg(calendar, "light"), "utf8"),
  ]);
  console.log(`Generated heatmap SVG files in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
