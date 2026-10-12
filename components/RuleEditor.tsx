"use client"

import * as React from "react"
import "./rule-editor.css"
import {
  Check,
  CircleHelp,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { RuleCatalog } from "@/lib/api"
import { useLanguage } from "@/lib/i18n"
import type { Translate } from "@/lib/language"

export type RuleStatus = "draft" | "approved" | "archived"
export type BurdenLevel = "green" | "yellow" | "red"
export type ConditionConnector = "and" | "or"
export type ConditionComparator = ">" | ">=" | "<" | "<=" | "=" | "!=" | "between"

export interface RuleCondition {
  id: string
  parameter: string
  comparator: ConditionComparator
  value: string
  secondValue?: string
  unit: string
  burden: BurdenLevel
  connector?: ConditionConnector
}

export interface RuleRecommendation {
  id: string
  title: string
  shortText: string
  longText: string
  kind: "existing" | "new"
}

export interface RuleSource {
  id: string
  title: string
  organisation: string
  year: string
  url?: string
}

export interface RuleDefinition {
  id?: string
  name: string
  description: string
  groups: string[]
  ageMin: string
  ageMax: string
  gender: "all" | "female" | "male" | "diverse"
  conditions: RuleCondition[]
  recommendations: RuleRecommendation[]
  sources: RuleSource[]
  status: RuleStatus
}

export interface ExistingRecommendation {
  id: string
  title: string
  shortText: string
  longText: string
}

export interface ExistingSource {
  id: string
  title: string
  organisation: string
  year: string
  url?: string
}

export interface RuleEditorProps {
  initialValue?: Partial<RuleDefinition>
  catalog: RuleCatalog
  existingRecommendations?: ExistingRecommendation[]
  existingSources?: ExistingSource[]
  onSave: (rule: RuleDefinition) => Promise<void>
  disabled?: boolean
  className?: string
}

const getComparatorOptions = (t: Translate): { value: ConditionComparator; label: string }[] => [
  { value: ">", label: t("größer als", "greater than") },
  { value: ">=", label: t("mindestens", "at least") },
  { value: "<", label: t("kleiner als", "less than") },
  { value: "<=", label: t("höchstens", "at most") },
  { value: "=", label: t("gleich", "equal to") },
  { value: "!=", label: t("ungleich", "not equal to") },
  { value: "between", label: t("zwischen", "between") },
]

const getStatusOptions = (t: Translate): { value: RuleStatus; label: string; tone: "neutral" | "warning" | "success" | "muted" }[] => [
  { value: "draft", label: t("Entwurf", "Draft"), tone: "neutral" },
  { value: "approved", label: t("Freigegeben", "Approved"), tone: "success" },
  { value: "archived", label: t("Archiviert", "Archived"), tone: "muted" },
]

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const firstCondition = (catalog: RuleCatalog): RuleCondition => ({
  id: createId("condition"),
  parameter: catalog.parameters[0]?.id ?? "",
  comparator: ">",
  value: "",
  unit: catalog.parameters[0]?.unit ?? "",
  burden: "yellow",
})

const emptyRule = (catalog: RuleCatalog): RuleDefinition => ({
  name: "",
  description: "",
  groups: [],
  ageMin: "",
  ageMax: "",
  gender: "all",
  conditions: [firstCondition(catalog)],
  recommendations: [],
  sources: [],
  status: "draft",
})

function mergeInitialValue(catalog: RuleCatalog, initialValue?: Partial<RuleDefinition>): RuleDefinition {
  const base = emptyRule(catalog)
  return {
    ...base,
    ...initialValue,
    groups: initialValue?.groups ?? base.groups,
    conditions: initialValue?.conditions?.length ? initialValue.conditions : base.conditions,
    recommendations: initialValue?.recommendations ?? base.recommendations,
    sources: initialValue?.sources ?? base.sources,
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const id = React.useId()
  const control = React.isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
    && (children.type === Input || children.type === Textarea || children.type === "select")
    ? children
    : null
  return (
    <div className="rule-editor-field" role={control ? undefined : "group"} aria-labelledby={control ? undefined : `${id}-label`}>
      <div className="rule-editor-field-label">
        <Label id={`${id}-label`} htmlFor={control ? id : undefined} className="text-sm font-semibold text-slate-800">{label}</Label>
        {hint ? <span id={`${id}-hint`} className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {control ? React.cloneElement(control, { id, "aria-describedby": hint ? `${id}-hint` : undefined }) : children}
    </div>
  )
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="rule-editor-section-heading">
      <span className="rule-editor-section-number">{number}</span>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function statusClasses(tone: "neutral" | "warning" | "success" | "muted") {
  return {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    muted: "border-slate-200 bg-slate-100 text-slate-500",
  }[tone]
}

function burdenClasses(level: BurdenLevel, selected: boolean) {
  const colors = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    yellow: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  }
  return cn("rounded-lg border px-3 py-2 text-left transition", colors[level], selected && "ring-2 ring-teal-500 ring-offset-1")
}

function burdenLabel(level: BurdenLevel, t: Translate) {
  return { green: t("Keine", "None"), yellow: t("Erhöht", "Elevated"), red: t("Hoch", "High") }[level]
}

function formatCondition(condition: RuleCondition, catalog: RuleCatalog, t: Translate) {
  const parameter = catalog.parameters.find((option) => option.id === condition.parameter)
  const label = parameter?.label ?? condition.parameter
  if (condition.comparator === "between") {
    return t(
      `${label} zwischen ${condition.value || "…"} und ${condition.secondValue || "…"} ${condition.unit}`,
      `${label} between ${condition.value || "…"} and ${condition.secondValue || "…"} ${condition.unit}`,
    )
  }
  return `${label} ${condition.comparator} ${condition.value || "…"} ${condition.unit}`
}

export function RuleEditor({
  initialValue,
  catalog,
  existingRecommendations = [],
  existingSources = [],
  onSave,
  disabled = false,
  className,
}: RuleEditorProps) {
  const { language, t } = useLanguage()
  const comparatorOptions = getComparatorOptions(t)
  const statusOptions = getStatusOptions(t)
  const medicalGroups = catalog.groups
  const parameterOptions = catalog.parameters.map((parameter) => ({ ...parameter, value: parameter.id }))
  const [rule, setRule] = React.useState<RuleDefinition>(() => mergeInitialValue(catalog, initialValue))
  const [saving, setSaving] = React.useState(false)
  const [recommendationMode, setRecommendationMode] = React.useState<"existing" | "new">("existing")
  const [recommendationQuery, setRecommendationQuery] = React.useState("")
  const [sourceQuery, setSourceQuery] = React.useState("")
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [savedMessage, setSavedMessage] = React.useState<{ detail: string | null } | null>(null)

  const locale = language === "de" ? "de-DE" : "en-GB"
  const normalizedRecommendationQuery = recommendationQuery.trim().toLocaleLowerCase(locale)
  const filteredRecommendations = existingRecommendations.filter((recommendation) =>
    !normalizedRecommendationQuery
      || `${recommendation.title} ${recommendation.shortText} ${recommendation.longText}`.toLocaleLowerCase(locale).includes(normalizedRecommendationQuery),
  )
  const normalizedSourceQuery = sourceQuery.trim().toLocaleLowerCase(locale)
  const filteredSources = existingSources.filter((source) =>
    !normalizedSourceQuery
      || `${source.title} ${source.organisation} ${source.year} ${source.url ?? ""} ${source.organisation === "Deutscher Wetterdienst" ? "DWD" : ""}`.toLocaleLowerCase(locale).includes(normalizedSourceQuery),
  )

  const updateRule = React.useCallback(<K extends keyof RuleDefinition>(key: K, value: RuleDefinition[K]) => {
    setRule((current) => ({ ...current, [key]: value }))
    setSavedMessage(null)
  }, [])

  const updateCondition = (id: string, patch: Partial<RuleCondition>) => {
    updateRule("conditions", rule.conditions.map((condition) => condition.id === id ? { ...condition, ...patch } : condition))
  }

  const addCondition = () => {
    updateRule("conditions", [...rule.conditions, { ...firstCondition(catalog), connector: "and" }])
  }

  const removeCondition = (id: string) => {
    if (rule.conditions.length === 1) return
    const remaining = rule.conditions.filter((condition) => condition.id !== id)
    if (remaining[0]) remaining[0] = { ...remaining[0], connector: undefined }
    updateRule("conditions", remaining)
  }

  const toggleGroup = (id: string) => {
    const next = rule.groups.includes(id)
      ? rule.groups.filter((group) => group !== id)
      : [...rule.groups, id]
    updateRule("groups", next)
  }

  const addExistingRecommendation = (recommendation: ExistingRecommendation) => {
    if (rule.recommendations.some((item) => item.id === recommendation.id)) return
    updateRule("recommendations", [...rule.recommendations, { ...recommendation, kind: "existing" }])
  }

  const addNewRecommendation = () => {
    updateRule("recommendations", [...rule.recommendations, {
      id: createId("recommendation"),
      title: "",
      shortText: "",
      longText: "",
      kind: "new",
    }])
  }

  const updateRecommendation = (id: string, patch: Partial<RuleRecommendation>) => {
    updateRule("recommendations", rule.recommendations.map((recommendation) => recommendation.id === id ? { ...recommendation, ...patch } : recommendation))
  }

  const removeRecommendation = (id: string) => {
    updateRule("recommendations", rule.recommendations.filter((recommendation) => recommendation.id !== id))
  }

  const toggleSource = (source: ExistingSource) => {
    const selected = rule.sources.some((item) => item.id === source.id)
    updateRule("sources", selected
      ? rule.sources.filter((item) => item.id !== source.id)
      : [...rule.sources, source])
  }

  const isValid = rule.name.trim().length > 0
    && rule.groups.length > 0
    && rule.conditions.length > 0
    && rule.conditions.every((condition) => {
      if (!condition.parameter.trim() || !condition.value.trim()) return false
      const firstValue = Number(condition.value.trim().replace(",", "."))
      if (!Number.isFinite(firstValue)) return false
      if (condition.comparator !== "between") return true
      if (!(condition.secondValue ?? "").trim()) return false
      const secondValue = Number((condition.secondValue ?? "").trim().replace(",", "."))
      return Number.isFinite(secondValue) && secondValue > firstValue
    })
    && rule.recommendations.every((recommendation) => recommendation.title.trim().length > 0 && recommendation.shortText.trim().length > 0)
    && rule.sources.every((source) => source.title.trim() && source.organisation.trim() && /^\d{4}$/.test(source.year) && (!source.url || /^https?:\/\//i.test(source.url)))
    && [rule.ageMin, rule.ageMax].every((age) => !age.trim() || (/^\d+$/.test(age) && Number(age) <= 120))
    && (!rule.ageMin || !rule.ageMax || Number(rule.ageMin) <= Number(rule.ageMax))
    && rule.conditions.every((condition) => catalog.parameters.some((parameter) => parameter.id === condition.parameter))
    && rule.groups.every((group) => catalog.groups.some((option) => option.id === group))
  const currentStatus = statusOptions.find((option) => option.value === rule.status) ?? statusOptions[0]
  const selectedGroups = medicalGroups.filter((group) => rule.groups.includes(group.id))

  const save = async () => {
    if (saving || disabled) return
    setSaving(true)
    setSavedMessage(null)
    try {
      await onSave(rule)
    } catch (error) {
      setSavedMessage({ detail: error instanceof Error ? error.message : null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset disabled={saving || disabled} className={cn("rule-editor", className)}>
      <div className="rule-editor-layout">
      <div className="rule-editor-content">
        <div className="rule-editor-intro">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">{t("HABITAT · REGELVERWALTUNG", "HABITAT · RULE MANAGEMENT")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{initialValue?.id ? t("Regel bearbeiten", "Edit rule") : t("Neue Regel anlegen", "Create new rule")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">{t("Definieren Sie Bedingungen, Zielgruppe und evidenzbasierte Empfehlungen für die Regelprüfung.", "Define conditions, target groups and evidence-based recommendations for rule evaluation.")}</p>
          </div>
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("Hilfe zum Regelsystem", "Rule system help")}>
                <CircleHelp />
              </Button>
            </DialogTrigger>
            <DialogContent className="rule-editor-dialog" closeLabel={t("Schließen", "Close")}>
              <DialogHeader>
                <DialogTitle>{t("Das HABITAT-Regelsystem", "The HABITAT rule system")}</DialogTitle>
                <DialogDescription>{t("Eine Regel verbindet Umweltbedingungen mit einer oder mehreren medizinischen Empfehlungen.", "A rule connects environmental conditions with one or more medical recommendations.")}</DialogDescription>
              </DialogHeader>
              <ol className="grid gap-3 text-sm leading-5 text-slate-600">
                <li className="flex gap-3"><span className="font-bold text-teal-700">1.</span><span>{t("Wählen Sie einen Umweltparameter und legen Sie Vergleich sowie Schwellenwert fest.", "Select an environmental parameter and define the comparison and threshold.")}</span></li>
                <li className="flex gap-3"><span className="font-bold text-teal-700">2.</span><span>{t("Verbinden Sie mehrere Bedingungen mit", "Connect multiple conditions using")} <b>{t("UND", "AND")}</b> {t("oder", "or")} <b>{t("ODER", "OR")}</b>.</span></li>
                <li className="flex gap-3"><span className="font-bold text-teal-700">3.</span><span>{t("Ordnen Sie medizinische Gruppen sowie Alter und Geschlecht zu.", "Assign medical groups, age and gender.")}</span></li>
                <li className="flex gap-3"><span className="font-bold text-teal-700">4.</span><span>{t("Verknüpfen Sie Empfehlungen und mindestens eine Quelle, bevor Sie die Regel einreichen.", "Link recommendations and at least one source before submitting the rule.")}</span></li>
              </ol>
              <div className="border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">{t("Live- und Simulationswerte durchlaufen dieselbe Regelprüfung. DWD-Gefahrenstufen werden nicht automatisch übernommen.", "Live and simulated values undergo the same rule evaluation. DWD hazard levels are not adopted automatically.")}</div>
              <DialogFooter><Button variant="outline" onClick={() => setHelpOpen(false)}>{t("Schließen", "Close")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <SectionHeading number="01" title={t("Regel beschreiben", "Describe the rule")} description={t("Geben Sie der Regel einen eindeutigen Namen und dokumentieren Sie ihren Zweck.", "Give the rule a unique name and document its purpose.")} />
          </CardHeader>
          <CardContent className="grid gap-5">
            <Field label={t("Name der Regel", "Rule name")} hint={t("Pflichtfeld", "Required")}>
              <Input value={rule.name} onChange={(event) => updateRule("name", event.target.value)} placeholder={t("z. B. Ozonbelastung bei Lungenerkrankungen", "e.g. Ozone exposure in lung disease")} />
            </Field>
            <Field label={t("Beschreibung", "Description")} hint={t("Optional", "Optional")}>
              <Textarea value={rule.description} onChange={(event) => updateRule("description", event.target.value)} placeholder={t("Welche Situation bildet diese Regel ab?", "What situation does this rule describe?")} rows={3} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeading number="02" title={t("Zielgruppe festlegen", "Define the target group")} description={t("Die Filter werden zusätzlich zu den Umweltbedingungen ausgewertet.", "These filters are evaluated in addition to the environmental conditions.")} />
          </CardHeader>
          <CardContent className="grid gap-6">
            <Field label={t("Medizinische Gruppen", "Medical groups")} hint={t("Mindestens eine Auswahl", "Select at least one")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {medicalGroups.map((group) => {
                  const selected = rule.groups.includes(group.id)
                  return (
                    <button key={group.id} type="button" aria-pressed={selected} onClick={() => toggleGroup(group.id)} className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition", selected ? "border-teal-400 bg-teal-50/70" : "border-slate-200 bg-white hover:border-slate-300")}>
                      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 text-transparent")}><Check size={13} /></span>
                      <span><span className="block text-sm font-semibold text-slate-800">{group.label}</span><span className="mt-1 block text-xs leading-4 text-slate-500">{group.id}</span></span>
                    </button>
                  )
                })}
              </div>
            </Field>
            <div className="rule-editor-demographics">
              <Field label={t("Alter von", "Age from")} hint={t("Jahre", "Years")}>
                <Input type="number" min="0" max="120" value={rule.ageMin} onChange={(event) => updateRule("ageMin", event.target.value)} placeholder={t("z. B. 65", "e.g. 65")} />
              </Field>
              <Field label={t("Alter bis", "Age to")} hint={t("Jahre", "Years")}>
                <Input type="number" min="0" max="120" value={rule.ageMax} onChange={(event) => updateRule("ageMax", event.target.value)} placeholder={t("z. B. 120", "e.g. 120")} />
              </Field>
              <Field label={t("Geschlecht", "Gender")}>
                <select aria-label={t("Geschlecht", "Gender")} value={rule.gender} onChange={(event) => updateRule("gender", event.target.value as RuleDefinition["gender"])} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
                  <option value="all">{t("Alle Geschlechter", "All genders")}</option>
                  <option value="female">{t("Weiblich", "Female")}</option>
                  <option value="male">{t("Männlich", "Male")}</option>
                  <option value="diverse">{t("Divers", "Diverse")}</option>
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeading number="03" title={t("Bedingungen definieren", "Define conditions")} description={t("UND bindet stärker als ODER: A ODER B UND C bedeutet A ODER (B UND C). Jeder ODER-Zweig wird als separater UND-Entwurf gespeichert. Bei Bearbeitung aktualisiert der erste Zweig die vorhandene Regel; weitere Zweige werden neu angelegt. Erst die Veröffentlichung aktiviert Änderungen.", "AND takes precedence over OR: A OR B AND C means A OR (B AND C). Each OR branch is saved as a separate AND draft. When editing, the first branch updates the existing rule; additional branches are created as new rules. Changes only become active upon publication.")} />
          </CardHeader>
          <CardContent className="grid gap-4">
            {rule.conditions.map((condition, index) => {
              const parameter = parameterOptions.find((option) => option.value === condition.parameter)
              return (
                <React.Fragment key={condition.id}>
                  {index > 0 ? (
                    <div className="flex items-center gap-3 pl-2">
                      <span className="h-px flex-1 bg-slate-200" />
                      <select aria-label={t(`Verknüpfung vor Bedingung ${index + 1}`, `Connector before condition ${index + 1}`)} value={condition.connector ?? "and"} onChange={(event) => updateCondition(condition.id, { connector: event.target.value as ConditionConnector })} className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold uppercase tracking-wide text-teal-800 outline-none focus:border-teal-500">
                        <option value="and">{t("UND", "AND")}</option>
                        <option value="or">{t("ODER", "OR")}</option>
                      </select>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                  ) : null}
                  <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t(`Bedingung ${index + 1}`, `Condition ${index + 1}`)}</span>{rule.conditions.length > 1 ? <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeCondition(condition.id)} aria-label={t(`Bedingung ${index + 1} löschen`, `Delete condition ${index + 1}`)}><Trash2 /></Button> : null}</div>
                    <div className="rule-editor-condition-fields">
                      <Field label={t("Umweltparameter", "Environmental parameter")}>
                        <select value={condition.parameter} onChange={(event) => { const option = parameterOptions.find((item) => item.value === event.target.value); updateCondition(condition.id, { parameter: event.target.value, unit: option?.unit ?? "" }) }} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
                          {parameterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </Field>
                      <Field label={t("Vergleich", "Comparison")}>
                        <select value={condition.comparator} onChange={(event) => updateCondition(condition.id, { comparator: event.target.value as ConditionComparator })} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
                          {comparatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </Field>
                      <Field label={condition.comparator === "between" ? t("Werte", "Values") : t("Schwellenwert", "Threshold")} hint={condition.unit}>
                        <div className="flex min-w-0 items-center gap-2"><Input aria-label={condition.comparator === "between" ? t("Unterer Wert", "Lower value") : t("Schwellenwert", "Threshold")} value={condition.value} onChange={(event) => updateCondition(condition.id, { value: event.target.value })} placeholder={t("Wert", "Value")} inputMode="decimal" />{condition.comparator === "between" ? <><span className="text-xs text-slate-500">{t("bis", "to")}</span><Input aria-label={t("Oberer Wert", "Upper value")} value={condition.secondValue ?? ""} onChange={(event) => updateCondition(condition.id, { secondValue: event.target.value })} placeholder={t("Wert", "Value")} inputMode="decimal" /></> : null}</div>
                      </Field>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-700">{t("Belastung bei Auslösung", "Burden when triggered")}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(["green", "yellow", "red"] as BurdenLevel[]).map((level) => <button type="button" key={level} aria-pressed={condition.burden === level} onClick={() => updateCondition(condition.id, { burden: level })} className={burdenClasses(level, condition.burden === level)}><span className="flex items-center gap-2 text-xs font-semibold"><span className={cn("size-2.5 rounded-full", level === "green" && "bg-emerald-500", level === "yellow" && "bg-amber-400", level === "red" && "bg-red-500")} />{burdenLabel(level, t)}</span><span className="mt-1 block text-[11px] opacity-75">{level === "green" ? t("Keine aktive Belastung", "No active burden") : level === "yellow" ? t("Erhöhte Aufmerksamkeit", "Increased attention") : t("Hohe Belastung", "High burden")}</span></button>)}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{t("Vorschau:", "Preview:")} <span className="font-medium text-slate-700">{formatCondition({ ...condition, unit: parameter?.unit ?? condition.unit }, catalog, t)}</span></p>
                  </div>
                </React.Fragment>
              )
            })}
            <Button type="button" variant="outline" onClick={addCondition} className="w-fit"><Plus /> {t("Bedingung hinzufügen", "Add condition")}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeading number="04" title={t("Empfehlungen verknüpfen", "Link recommendations")} description={t("Nutzen Sie eine bestehende Empfehlung oder erstellen Sie einen neuen Kurz- und Langtext.", "Use an existing recommendation or create new short and detailed texts.")} />
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rule-editor-mode">
              <button type="button" aria-pressed={recommendationMode === "existing"} onClick={() => setRecommendationMode("existing")} className={cn("rounded-md px-3 py-2 text-xs font-semibold", recommendationMode === "existing" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500")}>{t("Bestehende wählen", "Choose existing")}</button>
              <button type="button" aria-pressed={recommendationMode === "new"} onClick={() => setRecommendationMode("new")} className={cn("rounded-md px-3 py-2 text-xs font-semibold", recommendationMode === "new" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500")}>{t("Neue anlegen", "Create new")}</button>
            </div>
            {recommendationMode === "existing" ? (
              <div className="grid gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    aria-label={t("Empfehlungen durchsuchen", "Search recommendations")}
                    value={recommendationQuery}
                    onChange={(event) => setRecommendationQuery(event.target.value)}
                    placeholder={t("Empfehlungen durchsuchen …", "Search recommendations …")}
                    className="pl-9"
                  />
                </div>
                {filteredRecommendations.map((recommendation) => {
                  const selected = rule.recommendations.some((item) => item.id === recommendation.id)
                  return <button type="button" key={recommendation.id} onClick={() => selected ? removeRecommendation(recommendation.id) : addExistingRecommendation(recommendation)} className={cn("flex items-start gap-3 rounded-lg border p-3 text-left", selected ? "border-teal-400 bg-teal-50/70" : "border-slate-200 bg-white hover:border-slate-300")}><span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 text-transparent")}><Check size={13} /></span><span><span className="block text-sm font-semibold text-slate-800">{recommendation.title}</span><span className="mt-1 block text-xs leading-4 text-slate-500">{recommendation.shortText}</span></span></button>
                })}
                {!filteredRecommendations.length ? <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">{t("Keine Empfehlung gefunden.", "No recommendations found.")}</p> : null}
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={addNewRecommendation} className="w-fit"><Plus /> {t("Neue Empfehlung hinzufügen", "Add new recommendation")}</Button>
            )}
            {rule.recommendations.map((recommendation, index) => <div key={recommendation.id} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t(`Empfehlung ${index + 1}`, `Recommendation ${index + 1}`)}</span><Badge variant="outline">{recommendation.kind === "existing" ? t("Bestehend", "Existing") : t("Neu", "New")}</Badge></div><Button type="button" variant="ghost" size="icon-xs" onClick={() => removeRecommendation(recommendation.id)} aria-label={t("Empfehlung entfernen", "Remove recommendation")}><X /></Button></div><><Field label={t("Titel", "Title")}><Input value={recommendation.title} onChange={(event) => updateRecommendation(recommendation.id, { title: event.target.value })} placeholder={t("Kurzer, handlungsorientierter Titel", "Short, action-oriented title")} /></Field><Field label={t("Kurzempfehlung", "Short recommendation")}><Textarea value={recommendation.shortText} onChange={(event) => updateRecommendation(recommendation.id, { shortText: event.target.value })} placeholder={t("Ein Satz für die kompakte Ansicht", "One sentence for the compact view")} rows={2} /></Field><Field label={t("Langempfehlung", "Detailed recommendation")}><Textarea value={recommendation.longText} onChange={(event) => updateRecommendation(recommendation.id, { longText: event.target.value })} placeholder={t("Ausführliche Empfehlung mit konkreten Hinweisen", "Detailed recommendation with specific guidance")} rows={4} /></Field></></div>) }
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
          <SectionHeading number="05" title={t("Quellen hinterlegen", "Add sources")} description={t("Verknüpfen Sie wiederverwendbare Quellen für die evidenzbasierte Prüfung.", "Link reusable sources for evidence-based review.")} />
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label={t("Quellen durchsuchen", "Search sources")}
                value={sourceQuery}
                onChange={(event) => setSourceQuery(event.target.value)}
                placeholder={t("Quellen durchsuchen …", "Search sources …")}
                className="pl-9"
              />
            </div>
            {filteredSources.map((source) => { const selected = rule.sources.some((item) => item.id === source.id); return <button type="button" key={source.id} onClick={() => toggleSource(source)} className={cn("flex items-center gap-3 rounded-lg border p-3 text-left", selected ? "border-teal-400 bg-teal-50/70" : "border-slate-200 bg-white hover:border-slate-300")}><span className={cn("grid size-5 shrink-0 place-items-center rounded border", selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 text-transparent")}><Check size={13} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{source.title}</span><span className="mt-1 block text-xs text-slate-500">{source.organisation} · {source.year}</span></span>{selected ? <Badge variant="outline" className="border-teal-300 text-teal-800">{t("Verknüpft", "Linked")}</Badge> : null}</button> })}
            {!filteredSources.length ? <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">{t("Keine Quelle gefunden.", "No sources found.")}</p> : null}
            {rule.sources.map((source, index) => <div key={source.id} className="grid gap-3 rounded-lg border border-slate-200 p-4">
              <div className="flex justify-between"><b>{t(`Quelle ${index + 1}`, `Source ${index + 1}`)}</b><Button type="button" variant="ghost" onClick={() => updateRule("sources", rule.sources.filter((item) => item.id !== source.id))}>{t("Entfernen", "Remove")}</Button></div>
              {(["title", "organisation", "year", "url"] as const).map((field) => <label key={field} className="grid gap-1 text-sm">{{ title: t("Titel", "Title"), organisation: t("Organisation", "Organisation"), year: t("Jahr (JJJJ)", "Year (YYYY)"), url: t("URL (optional, https://…)", "URL (optional, https://…)") }[field]}<Input value={source[field] ?? ""} onChange={(event) => updateRule("sources", rule.sources.map((item) => item.id === source.id ? { ...item, [field]: event.target.value } : item))} /></label>)}
            </div>)}
            <Button type="button" variant="outline" className="w-fit" onClick={() => updateRule("sources", [...rule.sources, { id: createId("source"), title: "", organisation: "", year: "" }])}><Plus /> {t("Neue Quelle hinzufügen", "Add new source")}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeading number="06" title={t("Entwurf speichern", "Save draft")} description={t("Speichern veröffentlicht nichts. Berechtigte medizinische Editoren können gespeicherte Entwürfe direkt in der Regelübersicht veröffentlichen. Eine frühere Veröffentlichung bleibt bis dahin aktiv.", "Saving does not publish anything. Authorised medical editors can publish saved drafts directly from the rule overview. Any previous publication remains active until then.")} />
          </CardHeader>
          <CardFooter className="flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="text-xs text-slate-500" aria-live="polite">{savedMessage ? <>{t("Speichern fehlgeschlagen", "Save failed")}{savedMessage.detail ? `: ${savedMessage.detail}` : ""}</> : !isValid ? t("Name, gültige Grenzen (Alter 0–120), Gruppe, Empfehlung und vollständige Quelle (Jahr JJJJ, URL http/https) ergänzen", "Add a name, valid limits (age 0–120), group, recommendation and complete source (year YYYY, http/https URL)") : t("Alle Pflichtangaben vorhanden", "All required information provided")}</div>
            <Button type="button" onClick={save} disabled={!isValid || saving || disabled}>{saving ? t("Wird gespeichert …", "Saving …") : rule.conditions.some((condition) => condition.connector === "or") ? t("ODER-Zweige als Entwürfe speichern", "Save OR branches as drafts") : t("Entwurf speichern", "Save draft")}</Button>
          </CardFooter>
        </Card>
      </div>

      <div className="rule-editor-preview" role="complementary" aria-label={t("Review-Vorschau", "Review preview")}>
        <Card className="rule-editor-preview-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-3"><CardTitle className="text-base">{t("Review-Vorschau", "Review preview")}</CardTitle><Badge className={cn("border", statusClasses(currentStatus.tone))}>{currentStatus.label}</Badge></div>
            <CardDescription>{t("So erscheint die Regel in der Fachansicht.", "This is how the rule appears in the professional view.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("Regel", "Rule")}</p><p className="mt-1 font-semibold text-slate-900">{rule.name || t("Unbenannte Regel", "Unnamed rule")}</p>{rule.description ? <p className="mt-1 leading-5 text-slate-600">{rule.description}</p> : null}</div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("Zielgruppe", "Target group")}</p><p className="mt-1 text-slate-700">{selectedGroups.map((group) => group.label).join(", ")}</p><p className="mt-1 text-xs text-slate-500">{t(`Alter: ${rule.ageMin || "0"}–${rule.ageMax || "120"} Jahre · Geschlecht:`, `Age: ${rule.ageMin || "0"}–${rule.ageMax || "120"} years · Gender:`)} {rule.gender === "all" ? t("alle", "all") : rule.gender === "female" ? t("weiblich", "female") : rule.gender === "male" ? t("männlich", "male") : t("divers", "diverse")}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("Wenn", "If")}</p><div className="mt-2 grid gap-2">{rule.conditions.map((condition, index) => <React.Fragment key={condition.id}>{index > 0 ? <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">{condition.connector === "or" ? t("ODER", "OR") : t("UND", "AND")}</p> : null}<div className="flex items-center justify-between gap-2 rounded-md border border-teal-100 bg-white px-3 py-2"><span className="text-xs text-slate-700">{formatCondition(condition, catalog, t)}</span><span role="img" aria-label={burdenLabel(condition.burden, t)} className={cn("size-2.5 shrink-0 rounded-full", condition.burden === "green" && "bg-emerald-500", condition.burden === "yellow" && "bg-amber-400", condition.burden === "red" && "bg-red-500")} /></div></React.Fragment>)}</div></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("Dann empfehlen", "Then recommend")}</p>{rule.recommendations.length ? <ul className="mt-2 grid gap-2">{rule.recommendations.map((recommendation) => <li key={recommendation.id} className="flex gap-2 rounded-md border border-teal-100 bg-white px-3 py-2 text-xs text-slate-700"><Check size={14} className="mt-0.5 shrink-0 text-teal-700" />{recommendation.title || t("Neue Empfehlung ohne Titel", "Untitled new recommendation")}</li>)}</ul> : <p className="mt-2 text-xs italic text-slate-500">{t("Noch keine Empfehlung verknüpft.", "No recommendations linked yet.")}</p>}</div>
            <div className="grid grid-cols-2 gap-3 border-t border-teal-100 pt-4 text-xs"><div><span className="block text-slate-500">{t("Quellen", "Sources")}</span><b className="mt-1 block text-slate-800">{rule.sources.length}</b></div><div><span className="block text-slate-500">{t("Bedingungen", "Conditions")}</span><b className="mt-1 block text-slate-800">{rule.conditions.length}</b></div></div>
          </CardContent>
        </Card>
      </div>
      </div>
    </fieldset>
  )
}

export default RuleEditor
