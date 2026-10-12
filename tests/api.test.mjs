import assert from "node:assert/strict";
import { test } from "node:test";
import { api, ApiError, splitRuleDraft } from "../lib/api.ts";

const catalog = { groups: [{ id: "copd", label: "COPD" }], parameters: [{ id: "temperature", unit: "°C", live: true }] };
const condition = (id, connector) => ({ id, parameter: "temperature", comparator: ">", value: " 2,5 ", unit: "incorrect", burden: "yellow", connector });
const draft = (conditions) => ({ name: "Test", description: "", groups: ["copd"], ageMin: "", ageMax: "", gender: "all", status: "draft", conditions, recommendations: [], sources: [] });

test("AND has precedence over OR and payloads remain independent drafts", () => {
  const source = draft([condition("A"), condition("B", "or"), condition("C", "and")]);
  const branches = splitRuleDraft(source, catalog);
  assert.deepEqual(branches.map((branch) => branch.conditions.map((item) => item.id)), [["A"], ["B", "C"]]);
  assert.equal(branches[1].conditions[1].connector, "and");
  assert.equal(branches[0].conditions[0].connector, undefined);
  assert.equal(branches[0].conditions[0].value, "2.5");
  assert.equal(branches[0].conditions[0].unit, "°C");
  assert.equal(source.conditions[0].unit, "incorrect");
  assert.equal("status" in branches[0], false);
});

test("AND-only expression produces one draft and COPD remains independent", () => {
  const branches = splitRuleDraft(draft([condition("A"), condition("B", "and")]), catalog);
  assert.equal(branches.length, 1);
  assert.deepEqual(branches[0].groups, ["copd"]);
  assert.equal(branches[0].name, "Test");
});

test("empty or unknown conditions cannot be transported", () => {
  assert.throws(() => splitRuleDraft(draft([]), catalog), /Bedingung/);
  assert.throws(() => splitRuleDraft(draft([{ ...condition("A"), parameter: "invalid" }]), catalog), /Unbekannter/);
});

test("API unwraps server data and forwards bearer authentication", async (context) => {
  context.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.headers.get("Authorization"), "Bearer test-token");
    return Response.json({ message: "OK", data: { id: "rule" } });
  });
  assert.deepEqual(await api("/rules", "test-token"), { id: "rule" });
});

test("API rejects malformed envelopes and retains server validation details", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () => Response.json("unexpected"));
  await assert.rejects(api("/rules"), /data fehlt/);
  fetch.mock.mockImplementation(async () => Response.json({ message: "Invalid rule", errors: { groups: "required" } }, { status: 400 }));
  await assert.rejects(api("/rules"), (error) => error instanceof ApiError && error.status === 400 && error.message.includes("groups: required"));
});
