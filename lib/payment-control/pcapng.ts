// Bounded PCAPNG parser and payload removal. Accept Ethernet/RAW/NULL/LOOP
// TCP/443; discard unknown metadata and reject decryption-secret blocks.
import { createHash } from "node:crypto";
import { isIP } from "node:net";
export const PCAP_MAX_BYTES = 2097152;
function block(type: number, content: Buffer) {
  const padding = (4 - content.length % 4) % 4;
  const out = Buffer.alloc(12 + content.length + padding);
  out.writeUInt32LE(type, 0); out.writeUInt32LE(out.length, 4);
  content.copy(out, 8); out.writeUInt32LE(out.length, out.length - 4);
  return out;
}
export function canonicalPcapng(packets: Array<{ data: Buffer; originalLength: number; high: number; low: number }>, linkType = 1) {
  const section = Buffer.alloc(16); section.writeUInt32LE(0x1a2b3c4d); section.writeUInt16LE(1, 4); section.writeBigInt64LE(-1n, 8);
  const iface = Buffer.alloc(8); iface.writeUInt16LE(linkType); iface.writeUInt32LE(256, 4);
  return Buffer.concat([block(0x0a0d0d0a, section), block(1, iface), ...packets.map(p => {
    const head = Buffer.alloc(20); head.writeUInt32LE(p.high, 4); head.writeUInt32LE(p.low, 8);
    head.writeUInt32LE(p.data.length, 12); head.writeUInt32LE(p.originalLength, 16);
    return block(6, Buffer.concat([head, p.data]));
  })]);
}
function packetHeader(packet: Buffer, linkType: number, allowedIps: readonly string[]) {
  let ip = 0;
  if (linkType === 1) {
    if (packet.length < 14) throw new Error("INVALID_PACKET");
    const ether = packet.readUInt16BE(12);
    if (ether !== 0x0800 && ether !== 0x86dd) throw new Error("OUT_OF_SCOPE_PACKET");
    ip = 14;
  } else if (linkType === 0 || linkType === 108) {
    // Npcap BSD loopback (NULL) and network-endian LOOP headers. Only AF_INET
    // is supported here. Production destination policy still rejects loopback.
    if (packet.length < 4 || (linkType === 0 ? packet.readUInt32LE(0) : packet.readUInt32BE(0)) !== 2) throw new Error("UNSUPPORTED_LINK_TYPE");
    ip = 4;
  } else if (linkType !== 101) throw new Error("UNSUPPORTED_LINK_TYPE");
  if (packet.length < ip + 20) throw new Error("INVALID_PACKET");
  const version = packet[ip] >> 4;
  let tcp: number, src: string, dst: string;
  if (version === 4) {
    const ihl = (packet[ip] & 15) * 4;
    if (ihl < 20 || packet[ip + 9] !== 6 || (packet.readUInt16BE(ip + 6) & 0x3fff) !== 0) throw new Error("OUT_OF_SCOPE_PACKET");
    src = [...packet.subarray(ip + 12, ip + 16)].join("."); dst = [...packet.subarray(ip + 16, ip + 20)].join("."); tcp = ip + ihl;
  } else if (version === 6) {
    if (packet.length < ip + 40 || packet[ip + 6] !== 6) throw new Error("UNSUPPORTED_IPV6_EXTENSION");
    const addr = (n: number) => new URL(`http://[${Array.from({ length: 8 }, (_, i) => packet.readUInt16BE(n + i * 2).toString(16)).join(":")}]`).hostname.slice(1, -1);
    src = addr(ip + 8); dst = addr(ip + 24); tcp = ip + 40;
  } else throw new Error("OUT_OF_SCOPE_PACKET");
  if (packet.length < tcp + 20) throw new Error("TRUNCATED_TCP_HEADER");
  const srcPort = packet.readUInt16BE(tcp), dstPort = packet.readUInt16BE(tcp + 2);
  if (!(allowedIps.includes(src) && srcPort === 443 || allowedIps.includes(dst) && dstPort === 443)) throw new Error("OUT_OF_SCOPE_PACKET");
  // Exclude TCP/IP options too; these can contain user data. Copy only fixed
  // protocol headers and normalize their lengths, leaving original wire length.
  const tcpSize = (packet[tcp + 12] >> 4) * 4;
  if (tcpSize < 20 || packet.length < tcp + tcpSize) throw new Error("TRUNCATED_TCP_HEADER");
  const data = Buffer.from(packet.subarray(0, tcp + tcpSize));
  if (version === 4 && tcp > ip + 20) data.fill(0, ip + 20, tcp);
  if (tcpSize > 20) data.fill(0, tcp + 20);
  return { data, reset: (packet[tcp + 13] & 4) !== 0 };
}
export function sanitizePcapng(input: Buffer, allowedIps: readonly string[]) {
  if (!Buffer.isBuffer(input) || input.length < 48 || input.length > PCAP_MAX_BYTES ||
      !allowedIps.length || allowedIps.some(ip => !isIP(ip))) throw new Error("INVALID_PCAPNG");
  let offset = 0, sections = 0, interfaces = 0, linkType = 1, packetsSeen = 0, resets = 0, timestampResolution = 6;
  const packets: Parameters<typeof canonicalPcapng>[0] = [];
  while (offset < input.length) {
    if (offset + 12 > input.length) throw new Error("INVALID_PCAPNG");
    const type = input.readUInt32LE(offset), length = input.readUInt32LE(offset + 4);
    if (length < 12 || length % 4 || offset + length > input.length || input.readUInt32LE(offset + length - 4) !== length) throw new Error("INVALID_PCAPNG");
    if (type === 0x0a0d0d0a) {
      if (++sections !== 1 || length < 28 || input.readUInt32LE(offset + 8) !== 0x1a2b3c4d || input.readUInt16LE(offset + 12) !== 1) throw new Error("UNSUPPORTED_PCAPNG_SECTION");
    } else if (!sections) throw new Error("INVALID_PCAPNG");
    else if (type === 1) {
      if (++interfaces !== 1 || length < 20) throw new Error("UNSUPPORTED_PCAPNG_INTERFACE");
      linkType = input.readUInt16LE(offset + 8);
      if (![0, 1, 101, 108].includes(linkType)) throw new Error("UNSUPPORTED_LINK_TYPE");
      // Normalize observed micro/nanosecond clocks to canonical microseconds.
      // Unsupported clocks fail closed instead of silently misreporting UTC.
      for (let p = offset + 16; p + 4 <= offset + length - 4;) {
        const code = input.readUInt16LE(p), size = input.readUInt16LE(p + 2);
        if (p + 4 + size > offset + length - 4) throw new Error("INVALID_PCAPNG");
        if (code === 9) {
          if (size !== 1 || ![6, 9].includes(input[p + 4])) throw new Error("UNSUPPORTED_TIMESTAMP_RESOLUTION");
          timestampResolution = input[p + 4];
        }
        p += 4 + Math.ceil(size / 4) * 4;
        if (code === 0) break;
      }
    } else if (type === 6) {
      if (interfaces !== 1 || length < 32 || input.readUInt32LE(offset + 8) !== 0) throw new Error("INVALID_PCAPNG");
      const captured = input.readUInt32LE(offset + 20), originalLength = input.readUInt32LE(offset + 24);
      if (captured > originalLength || captured > length - 32 || captured > 256 || ++packetsSeen > 20000) throw new Error("INVALID_PCAPNG_PACKET");
      const packet = packetHeader(input.subarray(offset + 28, offset + 28 + captured), linkType, allowedIps);
      resets += Number(packet.reset);
      const rawStamp = BigInt(input.readUInt32LE(offset + 12)) * 0x100000000n + BigInt(input.readUInt32LE(offset + 16));
      const stamp = timestampResolution === 9 ? rawStamp / 1000n : rawStamp;
      packets.push({ data: packet.data, originalLength, high: Number(stamp >> 32n), low: Number(stamp & 0xffffffffn) });
    } else if (type !== 5) {
      // Interface Statistics permitted then stripped. DSB, name resolution,
      // comments/custom blocks, simple/obsolete packet formats are rejected.
      throw new Error("UNSUPPORTED_PCAPNG_BLOCK");
    }
    offset += length;
  }
  if (sections !== 1 || interfaces !== 1) throw new Error("INVALID_PCAPNG");
  const data = canonicalPcapng(packets, linkType);
  return { data, packetCount: packets.length, resets, bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"), payloadPolicy: "NETWORK_TCP_HEADERS_REDACTED_OPTIONS" as const };
}
