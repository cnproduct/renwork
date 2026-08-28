import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, "..")
const sourceDir = path.join(appDir, "src", "models")
const outputPath = path.join(appDir, "models-site", "models", "api.json")
const devRenworkApi = "http://127.0.0.1:8791/api/v1"
const prodRenworkApi = process.env.RENWORK_INFERENCE_API ?? "https://www.rrenn.com/api/inference/v1"

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"))
}

function renworkProvider(models, api) {
  return {
    renwork: {
      id: "renwork",
      env: ["RENWORK_API_KEY"],
      npm: "@openrouter/ai-sdk-provider",
      name: "RenWork Models",
      api,
      models,
    },
  }
}

const isDevMode = process.env.OPENWORK_DEV_MODE === "1"
const base = await readJson(path.join(sourceDir, "base.json"))
const renworkModels = await readJson(path.join(sourceDir, "openwork-models.json"))
const renwork = renworkProvider(renworkModels, isDevMode ? devRenworkApi : prodRenworkApi)
const models = { ...base, ...renwork }

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(models)}\n`)

console.log(`[inference] generated ${path.relative(appDir, outputPath)} (${isDevMode ? "dev" : "prod"})`)
