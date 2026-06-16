/**
 * SSRF-Guard fuer benutzergesteuerte Endpunkt-URLs (Verbindungstest + Konfig).
 *
 * Der Worker macht im Verbindungstest einen serverseitigen Request gegen eine
 * vom Nutzer angegebene `base_url`. Ohne Einschraenkung koennte das als Proxy
 * gegen interne Ziele missbraucht werden (Cloud-Metadata 169.254.169.254,
 * private Netze, localhost). Diese Funktion laesst nur oeffentliche https-URLs
 * durch (Phase-1-Review F3).
 *
 * Restrisiko: DNS-Rebinding (oeffentlicher Hostname, der intern aufloest) ist in
 * v1 nicht abgedeckt — ein Edge-DNS-Resolve+Pinning ist hier unverhaeltnismaessig.
 */
export function isPublicHttpsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (!host) return false;

  // localhost-Varianten
  if (host === "localhost" || host === "ip6-localhost" || host.endsWith(".localhost")) {
    return false;
  }

  // IPv6-Literale pauschal blocken (loopback ::1, link-local fe80::, ULA fc00::/7).
  // `URL.hostname` liefert IPv6 ohne Klammern → enthaelt ":".
  if (host.includes(":")) return false;

  // IPv4-Literal: private/loopback/link-local/CGNAT-Ranges blocken.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const octets = ipv4.slice(1, 5).map(Number);
    if (octets.some((o) => o > 255)) return false;
    const [a, b] = octets;
    if (a === 0) return false; // 0.0.0.0/8
    if (a === 10) return false; // 10.0.0.0/8
    if (a === 127) return false; // loopback 127.0.0.0/8
    if (a === 169 && b === 254) return false; // link-local 169.254/16 (Cloud-Metadata!)
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64.0.0/10
    return true; // oeffentliches IPv4-Literal
  }

  // Numerische Nicht-dotted-quad-Formen (dword/octal/hex) wuerden sonst als
  // "benannter Host" durchrutschen und dieselben internen Ziele adressieren
  // (z.B. 2852039166 = 169.254.169.254, 0177.0.0.1 = 127.0.0.1, 0x7f000001).
  // Echte API-Endpoints sind stets Domainnamen → jeden rein numerischen/hex
  // Host ablehnen (jedes Label nur Ziffern oder 0x-Hex).
  if (host.split(".").every((label) => /^(0x[0-9a-f]+|\d+)$/.test(label))) {
    return false;
  }

  // Benannter Host (kein IP-Literal) → erlaubt.
  return true;
}
