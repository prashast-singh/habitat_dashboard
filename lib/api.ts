import type { RuleDefinition, RuleCondition, BurdenLevel } from "@/components/RuleEditor";
import type { Language } from "./language";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
export interface User { id: string; email: string; medicalEditor: boolean }
export interface LoginResponse { accessToken: string; refreshToken: string; expiresInSeconds: number }
export interface RuleCatalog {
  groups: { id: string; label: string }[];
  parameters: { id: string; label: string; unit: string; live: boolean }[];
}
export interface SavedRule extends RuleDefinition { id: string; revision: number; publishedVersion: number | null }
export interface RuleVersion { version: number; action: string; authorId: string; createdAt: string; rule: SavedRule }
export interface RuleImportResponse { importedCount: number; rules: SavedRule[] }
export type RulePayload = Omit<RuleDefinition, "id" | "status"> & { revision?: number };
export interface EvaluationRequest {
  groups: string[];
  age?: number;
  gender: RuleDefinition["gender"] | "unknown";
  measurements: Record<string, number | null>;
  ruleIds?: string[];
}
export interface EvaluationResponse {
  results: { ruleId: string; version: number; name: string; outcome: "MATCH" | "NO_MATCH" | "UNKNOWN"; severity: BurdenLevel | null; missingParameters: string[]; conditions: unknown[] }[];
  warnings: unknown[];
  recommendations: unknown[];
  overallSeverity: BurdenLevel | null;
  complete: boolean;
  status: "NO_RULES" | "NO_APPLICABLE_RULES" | "INCOMPLETE" | "COMPLETE";
  coverage: { totalRules: number; applicableRules: number; evaluatedRules: number; matchedRules: number; unknownRules: number };
}
export interface EnvironmentResponse {
  lat: number;
  lon: number;
  current: { timestamp: string; [parameter: string]: number | string | null };
  forecast: unknown[];
}
export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); this.name = "ApiError"; }
}
function detailText(details: unknown): string {
  if (!details) return "";
  if (typeof details === "string") return details;
  if (Array.isArray(details)) return details.map(detailText).join(" · ");
  if (typeof details === "object") return Object.entries(details).map(([key, value]) => `${key}: ${detailText(value)}`).join(" · ");
  return String(details);
}
export async function api<T>(path: string, token?: string, options: RequestInit = {}, language: Language = "de"): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, { ...options, headers, cache: "no-store", signal: options.signal ?? AbortSignal.timeout(25000) });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(language === "en"
      ? "Java API unreachable or request timed out. Check the connection and CORS. For writes, check the server state before retrying."
      : "Java-API nicht erreichbar oder Zeitüberschreitung. Verbindung und CORS prüfen. Bei Schreibvorgängen vor erneutem Senden den Serverstand prüfen.", 0);
  }
  const parsed: unknown = await response.json().catch(() => null);
  const body = parsed !== null && typeof parsed === "object"
    ? parsed as Record<string, unknown> : null;
  if (!response.ok) {
    const suffix = detailText(body?.errors);
    throw new ApiError(`${body?.message || `${language === "en" ? "API error" : "API-Fehler"} ${response.status}`}${suffix ? ` — ${suffix}` : ""}`, response.status, body?.errors);
  }
  if (!body || !("data" in body)) throw new ApiError(language === "en" ? "Invalid API response: data is missing." : "Ungültige API-Antwort: data fehlt.", response.status);
  return body.data as T;
}

// Transport normalization only: AND binds more tightly than OR.
export function splitRuleDraft(rule: RuleDefinition, catalog: RuleCatalog, language: Language = "de"): RulePayload[] {
  const branches: RuleCondition[][] = [];
  for (const [index, condition] of rule.conditions.entries()) {
    const parameter = catalog.parameters.find((item) => item.id === condition.parameter);
    if (!parameter) throw new Error(`${language === "en" ? "Unknown parameter" : "Unbekannter Parameter"}: ${condition.parameter}`);
    const normalized: RuleCondition = {
      ...condition, unit: parameter.unit, connector: "and",
      value: condition.value.trim().replace(",", "."),
      ...(condition.secondValue !== undefined ? { secondValue: condition.secondValue.trim().replace(",", ".") } : {}),
    };
    if (index === 0 || condition.connector === "or") branches.push([normalized]);
    else branches[branches.length - 1].push(normalized);
  }
  if (!branches.length) throw new Error(language === "en" ? "At least one condition is required." : "Mindestens eine Bedingung ist erforderlich.");
  return branches.map((conditions, index) => ({
    name: branches.length > 1 ? `${rule.name} · ODER ${index + 1}/${branches.length}` : rule.name,
    description: rule.description,
    groups: [...rule.groups], ageMin: rule.ageMin, ageMax: rule.ageMax, gender: rule.gender,
    conditions: conditions.map((condition, conditionIndex) => ({ ...condition, connector: conditionIndex ? "and" : undefined })),
    recommendations: rule.recommendations.map((item) => ({ ...item })),
    sources: rule.sources.map((item) => ({ ...item })),
  }));
}

export const environmentFields: Record<string, string> = {
  temperature: "temperature", humidity: "humidity", pm25: "pm25", aqi: "aqi", ozone: "ozone",
  "pressure-drop": "pressureDrop", "birch-pollen": "birchPollen", "grass-pollen": "grassPollen",
  "mugwort-pollen": "mugwortPollen", "alder-pollen": "alderPollen", "ragweed-pollen": "ragweedPollen",
};
