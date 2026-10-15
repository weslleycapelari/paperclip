import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, "../ui/src/i18n/locales");

const enPath = path.join(localesDir, "en.json");
const enMessages = JSON.parse(fs.readFileSync(enPath, "utf8"));

function syncTree(template, target) {
  if (typeof template !== "object" || template === null) {
    return typeof target === "string" ? target : template;
  }
  const result = {};
  for (const key of Object.keys(template).sort()) {
    if (key in target && typeof target[key] === typeof template[key]) {
      result[key] = syncTree(template[key], target[key]);
    } else {
      result[key] = template[key];
    }
  }
  return result;
}

const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json") && f !== "en.json");
for (const file of files) {
  const filePath = path.join(localesDir, file);
  try {
    const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const synced = syncTree(enMessages, current);
    fs.writeFileSync(filePath, JSON.stringify(synced, null, 2) + "\n", "utf8");
  } catch (err) {
    console.error(`Error syncing ${file}:`, err);
  }
}

console.log(`Synced ${files.length} locale files with en.json schema.`);
