import { getMcpServerName, type McpDirectoryInfo } from "../../../app/constants";
import { isManagedCloudMcpServerName } from "./cloud-mcp-user-state";

export function conflictsWithOpenworkConnect(
  entry: Pick<McpDirectoryInfo, "id" | "name" | "serverName" | "managedBy">,
): boolean {
  const serverName = entry.id ?? getMcpServerName({
    ...entry,
    description: "",
    oauth: false,
  });
  return entry.managedBy !== "openwork-connect" && isManagedCloudMcpServerName(serverName);
}
