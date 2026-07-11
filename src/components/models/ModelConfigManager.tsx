import { useState } from "react";
import { Box, KeyRound, Link2, Pencil, PlugZap, Plus, Save, Tag, Trash2, X } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import type { ModelConfigView } from "@/types";

interface Props {
  initialConfigs: ModelConfigView[];
  /** Server-seitiger Initial-Load fehlgeschlagen → Banner statt stumm leerer Liste. */
  loadError?: boolean;
}

interface FormState {
  label: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { label: "", baseUrl: "", modelName: "", apiKey: "" };

/** Liest eine API-Fehler-Antwort ({ error: string | zod-flattenError }) zu Text. */
function messageFromPayload(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const err: unknown = payload.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const fe = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const parts: string[] = [];
      if (fe.formErrors?.length) parts.push(...fe.formErrors);
      for (const [field, msgs] of Object.entries(fe.fieldErrors ?? {})) {
        if (msgs.length) parts.push(`${field}: ${msgs.join(", ")}`);
      }
      if (parts.length) return parts.join(" · ");
    }
  }
  return "Something went wrong. Please try again.";
}

export default function ModelConfigManager({ initialConfigs, loadError = false }: Props) {
  const [configs, setConfigs] = useState<ModelConfigView[]>(initialConfigs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(
    loadError ? "Couldn't load configurations. Please reload." : null,
  );
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Modell-IDs aus dem letzten Verbindungstest → Vorschlagsliste fuer "Modellname".
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  const isEditing = editingId !== null;

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setTestResult(null);
    // Endpunkt/Key geaendert → die alte Modell-Liste passt nicht mehr.
    if (key === "baseUrl" || key === "apiKey") setModelOptions([]);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError(null);
    setTestResult(null);
    setModelOptions([]);
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.label.trim()) next.label = "Label is required";
    if (!form.baseUrl.trim()) {
      next.baseUrl = "Base URL is required";
    } else if (!/^https:\/\/.+/i.test(form.baseUrl.trim())) {
      next.baseUrl = "Must be a https:// URL";
    }
    if (!form.modelName.trim()) next.modelName = "Model name is required";
    // Key ist nur beim Anlegen Pflicht; beim Editieren leer lassen = behalten.
    if (!isEditing && !form.apiKey) next.apiKey = "API key is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function refetch() {
    const res = await fetch("/api/models", { headers: { Accept: "application/json" } });
    if (res.status === 401) {
      window.location.href = "/auth/signin";
      return;
    }
    if (res.ok) {
      setConfigs((await res.json()) as ModelConfigView[]);
    } else {
      setServerError("Couldn't load configurations. Please reload.");
    }
  }

  async function submit() {
    setPending(true);
    setServerError(null);
    try {
      const body: Record<string, string> = {
        label: form.label.trim(),
        baseUrl: form.baseUrl.trim(),
        modelName: form.modelName.trim(),
      };
      // Beim Editieren nur senden, wenn ein neuer Key eingegeben wurde.
      if (form.apiKey) body.apiKey = form.apiKey;

      const res = await fetch(isEditing ? `/api/models/${editingId}` : "/api/models", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        window.location.href = "/auth/signin";
        return;
      }
      if (!res.ok) {
        setServerError(messageFromPayload(await res.json().catch(() => null)));
        return;
      }
      resetForm();
      await refetch();
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    void submit();
  }

  function startEdit(config: ModelConfigView) {
    setEditingId(config.id);
    setForm({ label: config.label, baseUrl: config.baseUrl, modelName: config.modelName, apiKey: "" });
    setErrors({});
    setServerError(null);
    setTestResult(null);
    setModelOptions([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this configuration?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/models/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
      if (res.status === 401) {
        window.location.href = "/auth/signin";
        return;
      }
      if (editingId === id) resetForm();
      await refetch();
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function testConnection() {
    // Editieren ohne neuen Key → Test gegen die gespeicherte Konfig (configId).
    // Sonst gegen die aktuell eingegebenen Felder.
    const useStored = isEditing && !form.apiKey;
    if (!useStored) {
      const next: FieldErrors = {};
      if (!/^https:\/\/.+/i.test(form.baseUrl.trim())) next.baseUrl = "Must be a https:// URL";
      if (!form.apiKey) next.apiKey = "API key is required to test";
      if (Object.keys(next).length) {
        setErrors(next);
        return;
      }
    }
    setTesting(true);
    setTestResult(null);
    try {
      const body = useStored ? { configId: editingId } : { baseUrl: form.baseUrl.trim(), apiKey: form.apiKey };
      const res = await fetch("/api/models/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = "/auth/signin";
        return;
      }
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setModelOptions([]);
        setTestResult({ ok: false, message: messageFromPayload(payload) });
        return;
      }
      const result = payload as { ok: boolean; modelCount?: number; reason?: string; models?: string[] };
      if (result.ok) {
        setModelOptions(Array.isArray(result.models) ? result.models : []);
        setTestResult({
          ok: true,
          message: `Connection ok${typeof result.modelCount === "number" ? ` — ${result.modelCount} models` : ""}.`,
        });
      } else {
        setModelOptions([]);
        setTestResult({ ok: false, message: result.reason ?? "Connection failed." });
      }
    } catch {
      setTestResult({ ok: false, message: "Network error — please try again." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Formular */}
      <form onSubmit={handleSubmit} noValidate className="border-border bg-card space-y-4 rounded-2xl border p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {isEditing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {isEditing ? "Edit configuration" : "New configuration"}
        </h2>

        <FormField
          id="label"
          label="Label"
          value={form.label}
          onChange={(v) => {
            setField("label", v);
          }}
          placeholder="e.g. OpenAI GPT-4o"
          error={errors.label}
          icon={<Tag className="size-4" />}
        />
        <FormField
          id="baseUrl"
          label="Base URL"
          value={form.baseUrl}
          onChange={(v) => {
            setField("baseUrl", v);
          }}
          placeholder="https://api.openai.com/v1"
          error={errors.baseUrl}
          icon={<Link2 className="size-4" />}
        />
        <FormField
          id="modelName"
          label="Model name"
          value={form.modelName}
          onChange={(v) => {
            setField("modelName", v);
          }}
          placeholder="gpt-4o"
          error={errors.modelName}
          icon={<Box className="size-4" />}
          list={modelOptions.length ? "model-name-options" : undefined}
          hint={
            modelOptions.length ? (
              <span className="text-muted-foreground mt-1 block text-xs">
                {modelOptions.length} models from the connection test — type to filter or enter freely.
              </span>
            ) : undefined
          }
        />
        {modelOptions.length ? (
          <datalist id="model-name-options">
            {modelOptions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        ) : null}
        <FormField
          id="apiKey"
          label="API key"
          type="password"
          value={form.apiKey}
          onChange={(v) => {
            setField("apiKey", v);
          }}
          placeholder={isEditing ? "leave empty to keep the key" : "sk-…"}
          error={errors.apiKey}
          icon={<KeyRound className="size-4" />}
        />

        <ServerError message={serverError} />

        {testResult ? (
          <p
            className={
              testResult.ok
                ? "border-success/30 bg-success/10 text-success flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                : "border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            }
          >
            <PlugZap className="size-4 shrink-0" />
            {testResult.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {isEditing ? <Save className="size-4" /> : <Plus className="size-4" />}
            {pending ? "Saving…" : isEditing ? "Save" : "Create"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testing}
            onClick={() => {
              void testConnection();
            }}
            className="border-border bg-muted text-foreground hover:bg-accent"
          >
            <PlugZap className="size-4" />
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {/* Liste */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your configurations</h2>
        {configs.length === 0 ? (
          <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
            No configurations yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {configs.map((config) => (
              <li
                key={config.id}
                className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate font-medium">{config.label}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {config.modelName} · {config.baseUrl}
                  </p>
                  <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <KeyRound className="size-3" />
                    <span className="tracking-widest">••••••••</span>
                    <span>Key stored</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      startEdit(config);
                    }}
                    className="border-border bg-muted text-foreground hover:bg-accent"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busyId === config.id}
                    onClick={() => {
                      void remove(config.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
