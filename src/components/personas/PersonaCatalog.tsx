import { useMemo, useState } from "react";
import { Copy, FileText, Globe, ListChecks, Lock, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PersonaStructuredFields, PersonaView } from "@/types";

interface Props {
  initialPersonas: PersonaView[];
  /** Server-seitiger Initial-Load fehlgeschlagen → Banner statt stumm leerer Liste. */
  loadError?: boolean;
}

type Mode = "freeform" | "structured";

interface FormState {
  name: string;
  description: string;
  tags: string;
  // Freitext
  systemPrompt: string;
  // Strukturiert (Listen: ein Eintrag pro Zeile)
  coreThinking: string;
  voice: string;
  decisionFilters: string;
  risks: string;
  exampleDialog: string;
  usage: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  tags: "",
  systemPrompt: "",
  coreThinking: "",
  voice: "",
  decisionFilters: "",
  risks: "",
  exampleDialog: "",
  usage: "",
};

const textAreaClass =
  "w-full rounded-lg border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground transition-colors focus:ring-2 focus:outline-none";

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

/** Parst die Tag-Eingabe (kommagetrennt) zu einem getrimmten, leeren-freien Array. */
function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Parst ein Listen-Textarea (ein Eintrag pro Zeile) zu getrimmten, leeren-freien Zeilen. */
function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
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
  const [mode, setMode] = useState<Mode>("freeform");
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

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (mode === "freeform") {
      if (!form.systemPrompt.trim()) next.systemPrompt = "System prompt is required";
    } else {
      if (parseLines(form.coreThinking).length === 0) next.coreThinking = "At least one entry (§1)";
      if (parseLines(form.voice).length === 0) next.voice = "At least one entry (§2)";
      if (parseLines(form.decisionFilters).length === 0) next.decisionFilters = "At least one entry (§3)";
      if (parseLines(form.risks).length === 0) next.risks = "At least one entry (§4)";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildBody(): Record<string, unknown> {
    const base = {
      name: form.name.trim(),
      description: form.description.trim(),
      tags: parseTags(form.tags),
    };
    if (mode === "freeform") {
      return { ...base, sourceKind: "freeform", systemPrompt: form.systemPrompt.trim() };
    }
    const structuredFields: PersonaStructuredFields = {
      coreThinking: parseLines(form.coreThinking),
      voice: parseLines(form.voice),
      decisionFilters: parseLines(form.decisionFilters),
      risks: parseLines(form.risks),
      exampleDialog: form.exampleDialog.trim() || undefined,
      usage: form.usage.trim() || undefined,
    };
    return { ...base, sourceKind: "structured", structuredFields };
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
        body: JSON.stringify(buildBody()),
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

  /** Sofort-Kopie (server-seitig): legt eine private „(Kopie)" an. */
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

  /** Anpassen: befuellt das Formular im passenden Modus als Vorlage (Submit = neue Persona). */
  function adapt(persona: PersonaView) {
    const base: FormState = {
      ...EMPTY_FORM,
      name: `${persona.name} (copy)`,
      description: persona.description,
      tags: persona.tags.join(", "),
    };
    if (persona.sourceKind === "structured" && persona.structuredFields) {
      const sf = persona.structuredFields;
      setForm({
        ...base,
        coreThinking: sf.coreThinking.join("\n"),
        voice: sf.voice.join("\n"),
        decisionFilters: sf.decisionFilters.join("\n"),
        risks: sf.risks.join("\n"),
        exampleDialog: sf.exampleDialog ?? "",
        usage: sf.usage ?? "",
      });
      setMode("structured");
    } else {
      setForm({ ...base, systemPrompt: persona.systemPrompt });
      setMode("freeform");
    }
    setErrors({});
    setServerError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Schaltet die Sichtbarkeit einer eigenen Persona um (privat ↔ global, S-07). */
  async function setVisibility(persona: PersonaView) {
    const next = persona.visibility === "global" ? "private" : "global";
    setBusyId(persona.id);
    setServerError(null);
    try {
      const res = await fetch(`/api/personas/${persona.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ visibility: next }),
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
    if (!window.confirm("Delete this persona?")) return;
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

  const hasInput = (Object.values(form) as string[]).some((v) => v.trim().length > 0);

  return (
    <div className="space-y-8">
      {/* Formular */}
      <form onSubmit={handleSubmit} noValidate className="border-border bg-card space-y-4 rounded-2xl border p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="size-4" />
          New persona
        </h2>

        {/* Modus-Umschaltung */}
        <div className="border-border bg-muted inline-flex rounded-lg border p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              switchMode("freeform");
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
              mode === "freeform" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <FileText className="size-3.5" />
            Freeform
          </button>
          <button
            type="button"
            onClick={() => {
              switchMode("structured");
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
              mode === "structured" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <ListChecks className="size-3.5" />
            Structured
          </button>
        </div>

        <FormField
          id="name"
          label="Name"
          value={form.name}
          onChange={(v) => {
            setField("name", v);
          }}
          placeholder="e.g. Skeptic"
          error={errors.name}
          icon={<FileText className="size-4" />}
        />

        <div>
          <label htmlFor="description" className="text-muted-foreground mb-1 block text-sm">
            Description
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => {
              setField("description", e.target.value);
            }}
            placeholder="What is this persona for? (optional)"
            rows={2}
            className={cn(textAreaClass, "border-border focus-visible:ring-ring")}
          />
        </div>

        <FormField
          id="tags"
          label="Tags"
          value={form.tags}
          onChange={(v) => {
            setField("tags", v);
          }}
          placeholder="comma-separated, e.g. review, critical-thinking"
          error={errors.tags}
          icon={<Tag className="size-4" />}
        />

        {mode === "freeform" ? (
          <div>
            <label htmlFor="systemPrompt" className="text-muted-foreground mb-1 block text-sm">
              System prompt
            </label>
            <textarea
              id="systemPrompt"
              value={form.systemPrompt}
              onChange={(e) => {
                setField("systemPrompt", e.target.value);
              }}
              placeholder="The system prompt that activates this persona…"
              rows={8}
              className={cn(
                textAreaClass,
                "font-mono text-sm",
                errors.systemPrompt
                  ? "border-destructive/60 focus-visible:ring-destructive"
                  : "border-border focus-visible:ring-ring",
              )}
            />
            {errors.systemPrompt ? <p className="text-destructive mt-1 text-xs">{errors.systemPrompt}</p> : null}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Structured per spec (§§1–4 required, §§5–6 optional). One entry per line. The system prompt is generated
              from these.
            </p>
            <StructuredListField
              id="coreThinking"
              label="§1 Core thinking"
              value={form.coreThinking}
              error={errors.coreThinking}
              onChange={(v) => {
                setField("coreThinking", v);
              }}
            />
            <StructuredListField
              id="voice"
              label="§2 Voice"
              value={form.voice}
              error={errors.voice}
              onChange={(v) => {
                setField("voice", v);
              }}
            />
            <StructuredListField
              id="decisionFilters"
              label="§3 Decision filters"
              value={form.decisionFilters}
              error={errors.decisionFilters}
              onChange={(v) => {
                setField("decisionFilters", v);
              }}
            />
            <StructuredListField
              id="risks"
              label="§4 Known risks"
              value={form.risks}
              error={errors.risks}
              onChange={(v) => {
                setField("risks", v);
              }}
            />
            <div>
              <label htmlFor="exampleDialog" className="text-muted-foreground mb-1 block text-sm">
                §5 Voice in action <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="exampleDialog"
                value={form.exampleDialog}
                onChange={(e) => {
                  setField("exampleDialog", e.target.value);
                }}
                rows={3}
                className={cn(textAreaClass, "border-border focus-visible:ring-ring")}
              />
            </div>
            <div>
              <label htmlFor="usage" className="text-muted-foreground mb-1 block text-sm">
                §6 Usage <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="usage"
                value={form.usage}
                onChange={(e) => {
                  setField("usage", e.target.value);
                }}
                rows={2}
                className={cn(textAreaClass, "border-border focus-visible:ring-ring")}
              />
            </div>
          </div>
        )}

        <ServerError message={serverError} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Creating…" : "Create"}
          </Button>
          {hasInput ? (
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
              Reset
            </Button>
          ) : null}
        </div>
      </form>

      {/* Tag-Filter */}
      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Filter:</span>
          <button
            type="button"
            onClick={() => {
              setActiveTag(null);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              activeTag === null
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            All
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
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {/* Liste */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Catalog</h2>
        {visiblePersonas.length === 0 ? (
          <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
            {personas.length === 0 ? "No personas yet." : "No persona with this tag."}
          </p>
        ) : (
          <ul className="space-y-3">
            {visiblePersonas.map((persona) => (
              <li
                key={persona.id}
                className="border-border bg-card flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{persona.name}</span>
                    {persona.visibility === "global" ? (
                      <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                        <Globe className="size-3" />
                        Global
                      </span>
                    ) : persona.isOwn ? (
                      <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                        <Lock className="size-3" />
                        Private
                      </span>
                    ) : null}
                    {persona.sourceKind === "structured" ? (
                      <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                        <ListChecks className="size-3" />
                        Structured
                      </span>
                    ) : null}
                  </p>
                  {persona.description ? (
                    <p className="text-muted-foreground mt-0.5 truncate text-sm">{persona.description}</p>
                  ) : null}
                  {persona.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {persona.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === persona.id}
                    onClick={() => {
                      void duplicate(persona.id);
                    }}
                    className="border-border bg-muted text-foreground hover:bg-accent"
                  >
                    <Copy className="size-3.5" />
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      adapt(persona);
                    }}
                    className="border-border bg-muted text-foreground hover:bg-accent"
                  >
                    <Pencil className="size-3.5" />
                    Adapt
                  </Button>
                  {persona.isOwn ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === persona.id}
                      title={
                        persona.visibility === "global"
                          ? "Set to private (only you can see it)"
                          : "Set to global (visible org-wide)"
                      }
                      onClick={() => {
                        void setVisibility(persona);
                      }}
                      className="border-border bg-muted text-foreground hover:bg-accent"
                    >
                      {persona.visibility === "global" ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
                      {persona.visibility === "global" ? "Private" : "Global"}
                    </Button>
                  ) : null}
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
                      Delete
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

interface StructuredListFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/** Listen-Textarea (ein Eintrag pro Zeile) fuer die strukturierten §§1–4-Felder. */
function StructuredListField({ id, label, value, error, onChange }: StructuredListFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-muted-foreground mb-1 block text-sm">
        {label} <span className="text-muted-foreground">(one entry per line)</span>
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        rows={3}
        className={cn(
          textAreaClass,
          error ? "border-destructive/60 focus-visible:ring-destructive" : "border-border focus-visible:ring-ring",
        )}
      />
      {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
    </div>
  );
}
