import { SUPABASE_URL, SUPABASE_KEY, ENCRYPTION_KEY } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase is not configured — authentication is disabled.",
  },
  {
    name: "Encryption",
    configured: Boolean(ENCRYPTION_KEY),
    message: "ENCRYPTION_KEY is not configured — model configurations cannot be saved.",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
