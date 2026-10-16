const site = process.env.NEWSLETTER_SITE_URL;
const token = process.env.NEWSLETTER_JOB_TOKEN;
if (!site?.startsWith("https://") || !token) {
  throw new Error("Set NEWSLETTER_SITE_URL and the NEWSLETTER_JOB_TOKEN secret before scheduling email.");
}

let totalSent = 0;
let totalFailed = 0;
for (let page = 0; page < 40; page++) {
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(`${site}/api/newsletter/deliver`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 15_000));
      continue;
    }
    if (response.status !== 503 || attempt === 2) break;
    await new Promise(resolve => setTimeout(resolve, 15_000));
  }
  if (!response?.ok) throw new Error(`Newsletter endpoint returned ${response?.status ?? "no response"}`);
  const result = await response.json();
  totalSent += result.sent || 0;
  totalFailed += result.failed || 0;
  if (!result.remaining) {
    console.log(`Newsletter ${result.date}: ${totalSent} sent, ${totalFailed} failed.`);
    if (totalFailed) process.exitCode = 1;
    break;
  }
  if (page === 39) throw new Error("Delivery exceeded the 40-page run limit; another scheduled run will continue.");
}
