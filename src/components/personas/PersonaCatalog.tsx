import { useMemo, useState } from "react";
import { Copy, FileText, Globe, Plus, Tag, Trash2, X } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PersonaView } from "@/types";

interface Props {
  initialPersonas: PersonaView[];
  /** Server-seitiger Initial-Load fehlgeschlagen → Banner statt stumm leerer Liste. */
  loadError?: boolean;
}

interface FormState {
  name: string;
  description: string;
  tags: string;
  systemPrompt: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { name: "", description: "", tags: "", systemPrompt: "" };

/**
 * Navigations-Side-Effect bei 401. Bewusst auf Modul-Ebene (nicht in der
 * Komponente): das Setzen von `window.location.href` ist eine Mutation eines
 * globalen Werts, die der React-Compiler innerhalb von Komponenten/Hooks
 * verbietet (`react-hooks/immutability`). Als freie Modul-Funktion bleibt sie
 * ein gewoehnlicher Funktionsaufruf.
 */
function redirectToSignin() {
  window.location.href = "/auth/signin";
}

const textAreaClass =
  "w-full rounded-lg border bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:outline-none";

/** Parst die Tag-Eingabe (kommagetrennt) zu einem getrimmten, leeren-freien Array. */
function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

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

export default function PersonaCatalog({ initialPersonas, loadError = false }: Props) {
  const [personas, setPersonas] = useState<PersonaView[]>(initialPersonas);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(
    loadError ? "Couldn't load personas. Please reload." : null,
  );
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Vereinigung aller Tags der geladenen Personas (fuer die Filter-Leiste).
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of personas) for (const t of p.tags) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [personas]);

  const visiblePersonas = useMemo(
    () => (activeTag ? personas.filter((p) => p.tags.includes(activeTag)) : personas),
    [personas, activeTag],
  );

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError(null);
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.systemPrompt.trim()) next.systemPrompt = "System prompt is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function refetch() {
    const res = await fetch("/api/personas", { headers: { Accept: "application/json" } });
    if (res.status === 401) {
      redirectToSignin();
      return;
    }
    if (res.ok) {
      setPersonas((await res.json()) as PersonaView[]);
    } else {
      setServerError("Couldn't load personas. Please reload.");
    }
  }

  async function submit() {
    setPending(true);
    setServerError(null);
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          tags: parseTags(form.tags),
          systemPrompt: form.systemPrompt.trim(),
        }),
      });
      if (res.status === 401) {
        redirectToSignin();
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

  async function duplicate(id: string) {
    setBusyId(id);
    setServerError(null);
    try {
      const res = await fetch(`/api/personas/${id}/duplicate`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (res.status === 401) {
        redirectToSignin();
        return;
      }
      if (!res.ok) {
        setServerError(messageFromPayload(await res.json().catch(() => null)));
        return;
      }
      await refetch();
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Diese Persona löschen?")) return;
    setBusyId(id);
    setServerError(null);
    try {
      const res = await fetch(`/api/personas/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
      if (res.status === 401) {
        redirectToSignin();
        return;
      }
      await refetch();
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Formular */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="size-4" />
          Neue Persona
        </h2>

        <FormField
          id="name"
          label="Name"
          value={form.name}
          onChange={(v) => {
            setField("name", v);
          }}
          placeholder="z. B. Skeptiker"
          error={errors.name}
          icon={<FileText className="size-4" />}
        />

        <div>
          <label htmlFor="description" className="mb-1 block text-sm text-blue-100/80">
            Beschreibung
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => {
              setField("description", e.target.value);
            }}
            placeholder="Wofür ist diese Persona da? (optional)"
            rows={2}
            className={cn(textAreaClass, "border-white/20 focus:ring-purple-400")}
          />
        </div>

        <FormField
          id="tags"
          label="Tags"
          value={form.tags}
          onChange={(v) => {
            setField("tags", v);
          }}
          placeholder="kommagetrennt, z. B. review, kritisches-denken"
          error={errors.tags}
          icon={<Tag className="size-4" />}
        />

        <div>
          <label htmlFor="systemPrompt" className="mb-1 block text-sm text-blue-100/80">
            System-Prompt
          </label>
          <textarea
            id="systemPrompt"
            value={form.systemPrompt}
            onChange={(e) => {
              setField("systemPrompt", e.target.value);
            }}
            placeholder="Der System-Prompt, der diese Persona aktiviert…"
            rows={8}
            className={cn(
              textAreaClass,
              "font-mono text-sm",
              errors.systemPrompt ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
            )}
          />
          {errors.systemPrompt ? <p className="mt-1 text-xs text-red-300">{errors.systemPrompt}</p> : null}
        </div>

        <ServerError message={serverError} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending} className="bg-purple-600 text-white hover:bg-purple-500">
            <Plus className="size-4" />
            {pending ? "Anlegen…" : "Anlegen"}
          </Button>
          {form.name || form.description || form.tags || form.systemPrompt ? (
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
              className="text-blue-100/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
              Zurücksetzen
            </Button>
          ) : null}
        </div>
      </form>

      {/* Tag-Filter */}
      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-blue-100/50">Filter:</span>
          <button
            type="button"
            onClick={() => {
              setActiveTag(null);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              activeTag === null
                ? "border-purple-400 bg-purple-500/30 text-white"
                : "border-white/20 bg-white/5 text-blue-100/70 hover:bg-white/15",
            )}
          >
            Alle
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setActiveTag(tag);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                activeTag === tag
                  ? "border-purple-400 bg-purple-500/30 text-white"
                  : "border-white/20 bg-white/5 text-blue-100/70 hover:bg-white/15",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {/* Liste */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Katalog</h2>
        {visiblePersonas.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-blue-100/50">
            {personas.length === 0 ? "Noch keine Persona angelegt." : "Keine Persona mit diesem Tag."}
          </p>
        ) : (
          <ul className="space-y-3">
            {visiblePersonas.map((persona) => (
              <li
                key={persona.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-white">
                    <span className="truncate">{persona.name}</span>
                    {persona.visibility === "global" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/20 px-2 py-0.5 text-xs text-blue-200">
                        <Globe className="size-3" />
                        Global
                      </span>
                    ) : null}
                  </p>
                  {persona.description ? (
                    <p className="mt-0.5 truncate text-sm text-blue-100/60">{persona.description}</p>
                  ) : null}
                  {persona.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {persona.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-blue-100/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === persona.id}
                    onClick={() => {
                      void duplicate(persona.id);
                    }}
                    className="border-white/20 bg-white/5 text-white hover:bg-white/15"
                  >
                    <Copy className="size-3.5" />
                    Kopieren
                  </Button>
                  {persona.isOwn ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === persona.id}
                      onClick={() => {
                        void remove(persona.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Löschen
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
