import { NextResponse } from "next/server";
import { identity, isOriginalOwner } from "@/lib/editor-auth";
import { refreshFeedsIfDue, liveNews } from "@/lib/live-news";
import { deliverDigest, newsletterConfigured } from "@/lib/newsletter";

export const runtime = "edge";

const tools = [
  {
    name: "refresh_omnipulse_news",
    description: "Check OmniPulse's approved public publisher feeds and update its news database. Safe to retry; refreshes at most once per 15 minutes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "deliver_omnipulse_morning_digest",
    description: "Send today's source-linked email digest to the next batch of confirmed subscribers. Safe to retry; requires the email service to be configured. Repeat while remaining is true.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function rpc(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}
function failure(id: string | number | null, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: { name?: unknown } } | null;
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") return failure(null, -32600, "Invalid request", 400);
  const id = typeof body.id === "string" || typeof body.id === "number" ? body.id : null;
  if (body.method === "server/discover") return rpc(id, { supportedVersions: ["2026-07-28"], capabilities: { tools: {} } });
  if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (body.method === "initialize") return rpc(id, { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "omnipulse", version: "1.0.0" } });
  if (body.method === "ping") return rpc(id, {});
  if (body.method === "tools/list") return rpc(id, { tools });
  if (body.method !== "tools/call") return failure(id, -32601, "Method not found");

  const person = identity(req);
  if (!person) return failure(id, -32001, "Sign in as the OmniPulse owner", 401);
  if (!await isOriginalOwner(person.email)) return failure(id, -32003, "Owner access required", 403);
  const name = body.params?.name;
  if (name !== tools[0].name && name !== tools[1].name) return failure(id, -32602, "Unknown tool");

  try {
    if (name === tools[0].name) {
      await refreshFeedsIfDue();
      const { items, status } = await liveNews();
      const result = { checked_at: status.checked_at, success_at: status.success_at, source_error: status.error, recent_stories: items.length };
      return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
    }
    if (!newsletterConfigured()) return failure(id, -32003, "Email delivery has not been enabled", 503);
    const result = await deliverDigest();
    return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
  } catch (error) {
    console.error("OmniPulse owner tool failed", name, error);
    return failure(id, -32603, "The operation failed; retry shortly", 503);
  }
}
