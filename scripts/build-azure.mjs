import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const apiUrl = new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080");
if (apiUrl.protocol !== "https:" || apiUrl.pathname !== "/" || apiUrl.search || apiUrl.hash || apiUrl.username || apiUrl.password) {
  throw new Error("Set NEXT_PUBLIC_API_BASE_URL to the HTTPS backend origin without /api/v1 before building for Azure.");
}

const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "build",
], { stdio: "inherit", env: { ...process.env, HABITAT_STATIC_EXPORT: "1" } });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
