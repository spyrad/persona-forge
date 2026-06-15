// User-sichere Auth-Fehlermeldungen. Rohe Supabase-Fehler (Rate-Limit-,
// Provider-, Konfig-Details) werden nur serverseitig geloggt und nie in die
// URL/UI gespiegelt — verhindert Info-Leak und User-Enumeration (F1).
// Strukturelle Minimal-Typisierung statt Import aus @supabase/supabase-js,
// damit kein transitiver Type-Dependency-Pfad entsteht.
interface SupabaseAuthError {
  code?: string;
  status?: number;
  message: string;
}

const SAFE_BY_CODE: Record<string, string> = {
  email_not_confirmed: "Please confirm your email address first — check your inbox.",
  over_email_send_rate_limit: "Too many requests — please try again in a few minutes.",
  over_request_rate_limit: "Too many requests — please try again in a few minutes.",
};

// Loggt den Rohfehler serverseitig und gibt eine kontrollierte, user-sichere
// Meldung zurueck — bekannter Code → spezifischer Text, sonst der Fallback.
export function safeAuthError(error: SupabaseAuthError, fallback: string): string {
  // eslint-disable-next-line no-console -- bewusstes serverseitiges Audit-Log
  console.error("[auth]", error.status, error.code, error.message);
  const mapped = error.code ? SAFE_BY_CODE[error.code] : undefined;
  return mapped ?? fallback;
}
