import { describe, expect, test } from "bun:test"

import {
  runServer2016CloudDiagnostics,
  type Server2016DiagnosticsClient,
} from "@/react-app/shell/server-2016-cloud-diagnostics"

function healthyClient(): Server2016DiagnosticsClient {
  return {
    getSession: async () => ({ id: "user-1", email: "member@example.com", name: null }),
    getCloudInstance: async () => ({
      status: "ready",
      url: "https://worker.example.com",
      imageVersion: "v25",
      latestVersion: "v25",
    }),
    listWorkers: async () => [{
      workerId: "worker-1",
      workerName: "RenWork Cloud",
      status: "ready",
      instanceUrl: "https://worker.example.com",
      provider: "self_hosted",
      isMine: true,
      createdAt: null,
    }],
    getRenWorkModelCatalog: async () => ({ version: "catalog-v25", currency: "REN_CREDIT", models: [{
      providerID: "renwork",
      modelID: "renwork-code-kimi-k3",
      displayName: "Kimi K3",
      description: "Coding model",
      tier: "standard",
      autoEligible: true,
      contextWindow: null,
      tags: [],
      displayMultiplierBps: 10_000,
      effectiveDisplayMultiplierBps: 10_000,
      promotionLabel: null,
      promotionEndsAt: null,
      billingMode: "token_metered",
      executionLocation: "cloud",
    }] }),
    getRenCreditWallet: async () => ({
      organizationId: "org-1",
      availableMicroCredits: 2_000_000_000,
      reservedMicroCredits: 0,
      status: "active",
      version: 1,
    }),
  }
}

describe("Server 2016 cloud diagnostics", () => {
  test("reports every required cloud gate without returning credentials", async () => {
    const checks = await runServer2016CloudDiagnostics(healthyClient(), "org-1")

    expect(checks.map((check) => check.id)).toEqual(["session", "cloud", "worker", "models", "rencredit"])
    expect(checks.every((check) => check.state === "pass")).toBe(true)
    expect(JSON.stringify(checks)).not.toContain("https://worker.example.com")
  })

  test("isolates failures so the remaining checks still finish", async () => {
    const client = healthyClient()
    client.listWorkers = async () => []
    client.getRenWorkModelCatalog = async () => ({ version: "empty", currency: "REN_CREDIT", models: [] })

    const checks = await runServer2016CloudDiagnostics(client, "org-1")

    expect(checks.find((check) => check.id === "worker")?.state).toBe("fail")
    expect(checks.find((check) => check.id === "models")?.state).toBe("fail")
    expect(checks.find((check) => check.id === "rencredit")?.state).toBe("pass")
  })
})
