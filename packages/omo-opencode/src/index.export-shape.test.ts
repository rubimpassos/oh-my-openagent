import { describe, expect, it } from "bun:test"
import pluginModule, { omoPlugin } from "./index"

describe("oh-my-openagent plugin export shape", () => {
  it("default-exports a plugin V1 calls through server and V2 calls through setup", () => {
    // given / when / then
    expect(pluginModule.id).toBe("oh-my-openagent")
    expect(typeof pluginModule.setup).toBe("function")
    expect(typeof pluginModule.server).toBe("function")
    expect(pluginModule.server).toBe(omoPlugin)
  })

  it("requires the V2 host context rather than silently loading an inactive plugin", async () => {
    // given
    const definition: Record<string, unknown> = pluginModule

    // when
    const setup = definition["setup"]

    // then
    expect(definition["id"]).toBe("oh-my-openagent")
    expect(typeof definition["server"]).toBe("function")
    expect(typeof setup).toBe("function")
    if (typeof setup !== "function") throw new Error("setup missing")
    await expect(setup({})).rejects.toBeInstanceOf(TypeError)
  })
})
