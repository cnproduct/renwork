import { describe, expect, test } from "bun:test";

import {
  cloudWorkspaceUrl,
  selectCloudWorker,
} from "../src/react-app/shell/server-2016-cloud-workspace";

const instance = {
  status: "ready" as const,
  url: "https://worker-a.example/",
  imageVersion: "v21",
  latestVersion: "v21",
};

describe("Server 2016 cloud workspace selection", () => {
  test("selects only the signed-in user's worker for the active instance", () => {
    const selected = selectCloudWorker([
      {
        workerId: "other-user",
        workerName: "Other",
        status: "ready",
        instanceUrl: "https://worker-a.example",
        provider: "daytona",
        isMine: false,
        createdAt: null,
      },
      {
        workerId: "mine",
        workerName: "Mine",
        status: "ready",
        instanceUrl: "https://worker-a.example",
        provider: "daytona",
        isMine: true,
        createdAt: null,
      },
    ], instance);

    expect(selected?.workerId).toBe("mine");
  });

  test("does not fall back to another tenant member's worker", () => {
    expect(selectCloudWorker([
      {
        workerId: "not-mine",
        workerName: "Not mine",
        status: "ready",
        instanceUrl: "https://worker-a.example",
        provider: "daytona",
        isMine: false,
        createdAt: null,
      },
    ], instance)).toBeNull();
  });

  test("prefers Den's token-bound OpenWork URL", () => {
    expect(cloudWorkspaceUrl(instance, {
      workerId: "mine",
      workerName: "Mine",
      status: "ready",
      instanceUrl: "https://worker-row.example",
      provider: "daytona",
      isMine: true,
      createdAt: null,
    }, {
      clientToken: "client",
      ownerToken: "owner",
      hostToken: "host",
      openworkUrl: "https://signed-openwork.example",
      workspaceId: "workspace-1",
    })).toBe("https://signed-openwork.example");
  });
});
