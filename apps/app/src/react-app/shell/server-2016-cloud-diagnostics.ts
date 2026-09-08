import type { RenWorkPublicModelCatalog } from "@openwork/rencredit-metering"

import {
  DenApiError,
  type DenCloudInstance,
  type DenRenCreditWallet,
  type DenUser,
  type DenWorkerSummary,
} from "@/app/lib/den"

export type Server2016DiagnosticState = "pass" | "fail"

export type Server2016DiagnosticCheck = {
  id: "session" | "cloud" | "worker" | "models" | "rencredit"
  label: string
  detail: string
  state: Server2016DiagnosticState
}

export type Server2016DiagnosticsClient = {
  getSession: () => Promise<DenUser>
  getCloudInstance: (organizationId: string) => Promise<DenCloudInstance>
  listWorkers: (organizationId: string, limit: number) => Promise<DenWorkerSummary[]>
  getRenWorkModelCatalog: (organizationId: string) => Promise<RenWorkPublicModelCatalog>
  getRenCreditWallet: (organizationId: string) => Promise<DenRenCreditWallet>
}

type DiagnosticProbe = {
  id: Server2016DiagnosticCheck["id"]
  label: string
  run: () => Promise<string>
}

function safeFailureDetail(error: unknown) {
  if (error instanceof DenApiError) {
    const safeCode = /^[a-z0-9_-]{1,64}$/i.test(error.code) ? error.code : "request_failed"
    return `Request failed · HTTP ${error.status} · ${safeCode}`
  }
  if (error instanceof Error && [
    "Cloud workspace is provisioning",
    "Cloud workspace is waking",
    "Cloud workspace is failed",
    "No ready worker is available",
    "No worker is provisioned",
    "No RenWork models are authorized",
    "Wallet is suspended",
  ].includes(error.message)) return error.message
  return "The service check failed. Retry or contact the platform administrator."
}

export async function runServer2016CloudDiagnostics(
  client: Server2016DiagnosticsClient,
  organizationId: string,
): Promise<Server2016DiagnosticCheck[]> {
  const probes: DiagnosticProbe[] = [
    {
      id: "session",
      label: "RenWork Cloud sign-in",
      run: async () => {
        const user = await client.getSession()
        return user.email ? `Signed in as ${user.email}` : "Session is active"
      },
    },
    {
      id: "cloud",
      label: "Cloud workspace",
      run: async () => {
        const instance = await client.getCloudInstance(organizationId)
        if (instance.status !== "ready") throw new Error(`Cloud workspace is ${instance.status}`)
        return `Ready${instance.imageVersion ? ` · ${instance.imageVersion}` : ""}`
      },
    },
    {
      id: "worker",
      label: "Cloud worker",
      run: async () => {
        const workers = await client.listWorkers(organizationId, 50)
        const ready = workers.find((worker) => worker.status === "ready" || worker.status === "active")
        if (!ready) throw new Error(workers.length ? "No ready worker is available" : "No worker is provisioned")
        return `${ready.workerName} · ${ready.status}`
      },
    },
    {
      id: "models",
      label: "Model catalog",
      run: async () => {
        const catalog = await client.getRenWorkModelCatalog(organizationId)
        if (!catalog.models.length) throw new Error("No RenWork models are authorized")
        return `${catalog.models.length} authorized models · ${catalog.version}`
      },
    },
    {
      id: "rencredit",
      label: "RenCredit wallet",
      run: async () => {
        const wallet = await client.getRenCreditWallet(organizationId)
        if (wallet.status !== "active") throw new Error(`Wallet is ${wallet.status}`)
        return `${(wallet.availableMicroCredits / 1_000_000).toFixed(6)} available`
      },
    },
  ]

  return Promise.all(probes.map(async (probe) => {
    try {
      return { id: probe.id, label: probe.label, detail: await probe.run(), state: "pass" as const }
    } catch (error) {
      return { id: probe.id, label: probe.label, detail: safeFailureDetail(error), state: "fail" as const }
    }
  }))
}
