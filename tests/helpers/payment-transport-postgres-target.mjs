export const UAT_DATABASE = "gen_eco_transport_uat";

export class UatConnectedTargetError extends Error {
  constructor(checks, actual) {
    const reasons = Object.entries(checks).filter(([, passed]) => !passed).map(([code]) => code);
    // Values below are fixed classifications, never arbitrary server strings,
    // identifiers, usernames or URLs. Preserve diagnostics through redaction.
    super(`UAT_CONNECTED_TARGET_REJECTED\nReason: ${reasons.join(", ")}\n` +
      `Expected database: ${UAT_DATABASE}\nActual database: ${actual.database}\n` +
      `Expected port: 5432\nActual port: ${actual.port}\n` +
      `Expected schema: public\nActual schema: ${actual.schema}\n` +
      `Server address category: ${actual.address}\nConnection validation: FAILED`);
    this.name = "UatConnectedTargetError";
    this.code = "UAT_CONNECTED_TARGET_REJECTED";
    this.diagnostic = Object.freeze({ checks: Object.freeze(checks), actual: Object.freeze(actual) });
  }
}

export function testUrl(input) {
  if (!input) throw new Error("UAT_CREDENTIALS_UNAVAILABLE");
  let url;
  try { url = new URL(input); } catch { throw new Error("UAT_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "localhost" ||
      url.port !== "5432" || url.pathname !== `/${UAT_DATABASE}` || url.hash || !url.username ||
      new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length ||
      [...url.searchParams.keys()].some((key) => !["schema", "connection_limit", "pool_timeout", "connect_timeout", "socket_timeout", "sslmode"].includes(key)) ||
      url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") throw new Error("UAT_TARGET_REJECTED");
  url.searchParams.set("schema", "public"); url.searchParams.set("connection_limit", "6");
  url.searchParams.set("connect_timeout", "3"); url.searchParams.set("pool_timeout", "2");
  url.searchParams.set("socket_timeout", "3");
  return url.toString();
}

export function uatConnectionFromEnvironment(env = process.env) {
  // No DATABASE_URL / dotenv fallback, even if the application's URL is valid.
  return env.PAYMENT_TRANSPORT_UAT_DATABASE_URL;
}

export function assertConnectedTarget(row) {
  const checks = {
    UAT_DATABASE_MATCH: row?.db === UAT_DATABASE,
    UAT_PORT_MATCH: row?.port === 5432,
    UAT_SCHEMA_MATCH: row?.schema === "public",
    UAT_SERVER_LOOPBACK: row?.address === "127.0.0.1" || row?.address === "::1",
  };
  if (Object.values(checks).every(Boolean)) return;
  throw new UatConnectedTargetError(checks, {
    database: row?.db === UAT_DATABASE ? UAT_DATABASE : row?.db === "gen_eco" ? "gen_eco" : "OTHER_OR_UNAVAILABLE",
    port: Number.isInteger(row?.port) && row.port > 0 && row.port <= 65535 ? row.port : "INVALID_OR_UNAVAILABLE",
    schema: row?.schema === "public" ? "public" : "OTHER_OR_UNAVAILABLE",
    address: row?.address === "127.0.0.1" ? "IPV4_LOOPBACK" : row?.address === "::1" ? "IPV6_LOOPBACK"
      : ["127.0.0.1/32", "::1/128"].includes(row?.address) ? "UNNORMALIZED_LOOPBACK" : "OTHER_OR_UNAVAILABLE",
  });
}

export async function verifyConnectedTarget(tx, sql) {
  const rows = await tx.$queryRaw(sql`SELECT current_database() AS db,
    host(inet_server_addr()) AS address, inet_server_port() AS port, current_schema() AS schema`);
  assertConnectedTarget(rows[0]);
}
