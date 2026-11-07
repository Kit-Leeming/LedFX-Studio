export async function request(path, method = "GET", body) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await r.json();
    if (!r.ok || data.status === "failed" || data.status === "error")
      throw Error(
        data.reason ||
          data.message ||
          data.payload?.reason ||
          `LedFX rejected the request (${r.status}).`,
      );
    return data;
  } catch (e) {
    if (e.name === "AbortError")
      throw Error(
        "LedFX did not respond. Your draft is retained; retry when the backend is available.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export const load = () =>
  Promise.all([
    request("/api/studio"),
    request("/api/schema"),
    request("/api/devices"),
  ]);
