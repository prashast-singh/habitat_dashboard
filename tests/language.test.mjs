import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLanguage, translate, translateCatalog } from "../lib/language.ts";
import { api, ApiError, splitRuleDraft } from "../lib/api.ts";

test("language selection defaults to German and only accepts supported languages", () => {
  for (const value of [null, "", "fr", "EN", "de"]) assert.equal(parseLanguage(value), "de");
  assert.equal(parseLanguage("en"), "en");
  assert.equal(translate("de", "Entwurf", "Draft"), "Entwurf");
  assert.equal(translate("en", "Entwurf", "Draft"), "Draft");
});

test("catalog translation changes only known display labels without mutating server data", () => {
  const catalog = {
    groups: [{ id: "general", label: "Allgemein" }, { id: "copd", label: "COPD" }, { id: "future-group", label: "Future group" }],
    parameters: [{ id: "temperature", label: "Temperatur", unit: "°C", live: true }, { id: "future", label: "Future parameter", unit: "mm", live: false }],
  };
  const before = structuredClone(catalog);
  const english = translateCatalog(catalog, "en");
  assert.deepEqual(english.groups.map((group) => group.label), ["General", "COPD", "Future group"]);
  assert.equal(english.parameters[0].label, "Temperature");
  const contract = ({ id, unit, live }) => ({ id, unit, live });
  assert.deepEqual(english.parameters.map(contract), catalog.parameters.map(contract));
  assert.equal(english.parameters[1].label, "Future parameter");
  assert.deepEqual(catalog, before);
  assert.equal(translateCatalog(catalog, "de"), catalog);
});

test("both languages produce identical medical payloads and preserve authored content", () => {
  const catalog = { groups: [{ id: "lung", label: "Lunge" }], parameters: [{ id: "temperature", label: "Temperatur", unit: "°C", live: true }] };
  const condition = { id: "A", parameter: "temperature", comparator: ">", value: "1,5", unit: "°C", burden: "yellow" };
  const rule = { name: "Originaler Name", description: "Original content", groups: ["lung"], ageMin: "", ageMax: "", gender: "all", conditions: [condition, { ...condition, id: "B", connector: "or" }], recommendations: [], sources: [] };
  assert.deepEqual(splitRuleDraft(rule, translateCatalog(catalog, "en"), "en"), splitRuleDraft(rule, catalog, "de"));
  assert.throws(() => splitRuleDraft({ ...rule, conditions: [] }, catalog, "en"), /At least one condition/);
  assert.throws(() => splitRuleDraft({ ...rule, conditions: [{ ...condition, parameter: "missing" }] }, catalog, "en"), /Unknown parameter/);
});

test("English API client errors are localized while server messages remain verbatim", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () => Response.json("invalid"));
  await assert.rejects(api("/rules", undefined, {}, "en"), /data is missing/);
  fetch.mock.mockImplementation(async () => Response.json({}, { status: 503 }));
  await assert.rejects(api("/rules", undefined, {}, "en"), /API error 503/);
  fetch.mock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api("/rules", undefined, {}, "en"), (error) => error instanceof ApiError && error.status === 0 && error.message.includes("Java API unreachable"));
  fetch.mock.mockImplementation(async () => Response.json({ message: "Server validation", errors: { groups: "required" } }, { status: 400 }));
  await assert.rejects(api("/rules", undefined, {}, "en"), /Server validation — groups: required/);
});
