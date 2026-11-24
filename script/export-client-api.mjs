import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const destination = process.argv[2]
if (!destination) throw new TypeError("Usage: node script/export-client-api.mjs <consumer-vendor-directory>")
const source = "packages/omo-opencode/src/v2/client-api-contract.ts"
const root = fileURLToPath(new URL("..", import.meta.url))
const text = await readFile(resolve(root, source), "utf8")
const output = resolve(destination)
await mkdir(output, { recursive: true })
await writeFile(resolve(output, "omo-client-api-contract.ts"), text)
await writeFile(resolve(output, "omo-client-api-source.json"), `${JSON.stringify({
  repository: "https://github.com/rubimpassos/oh-my-openagent",
  contract: "omo.client.v1",
  source,
  sha256: createHash("sha256").update(text).digest("hex"),
}, null, 2)}\n`)
console.log(`Exported omo.client.v1 to ${output}`)
