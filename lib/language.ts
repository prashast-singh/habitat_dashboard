import type { RuleCatalog } from "./api";

export type Language = "de" | "en";
export type Translate = (german: string, english: string) => string;
export const LANGUAGE_STORAGE_KEY = "habitat-language";
export const translate = (language: Language, german: string, english: string) => language === "en" ? english : german;
export const parseLanguage = (value: string | null): Language => value === "en" ? "en" : "de";

const groups: Record<string, string> = {
  general: "General", lung: "Lungs", heart: "Heart", pregnancy: "Pregnancy", copd: "COPD",
};
const parameters: Record<string, string> = {
  temperature: "Temperature", "feels-like": "Feels-like temperature",
  "temperature-min": "Outdoor temperature (daily minimum)", ozone: "Ozone", pm25: "PM₂.₅", pm10: "PM₁₀",
  no2: "Nitrogen dioxide (NO₂)", aqi: "Air quality index (OpenWeather, 1–5)", humidity: "Humidity",
  pressure: "Air pressure", "pressure-drop": "Air pressure drop", "wind-speed": "Wind speed",
  precipitation: "Precipitation", "cloud-cover": "Cloud cover", visibility: "Visibility", "uv-index": "UV index",
  "grass-pollen": "Grass pollen", "birch-pollen": "Birch pollen", "alder-pollen": "Alder pollen",
  "mugwort-pollen": "Mugwort pollen", "ragweed-pollen": "Ragweed pollen",
};

// Only presentation labels change; backend IDs, units and entered medical content stay intact.
export function translateCatalog(catalog: RuleCatalog, language: Language): RuleCatalog {
  if (language === "de") return catalog;
  return {
    groups: catalog.groups.map((group) => ({ ...group, label: groups[group.id] ?? group.label })),
    parameters: catalog.parameters.map((parameter) => ({ ...parameter, label: parameters[parameter.id] ?? parameter.label })),
  };
}
