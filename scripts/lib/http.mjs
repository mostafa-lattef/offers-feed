export async function getText(url, headers = {}, timeoutMs = 30000) {
  const res = await fetch(url, {
    headers: { "user-agent": "offers-feed/2.0 (+mercora)", accept: "*/*", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} من ${new URL(url).host}`);
  return res.text();
}
