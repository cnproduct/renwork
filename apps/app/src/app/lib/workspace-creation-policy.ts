import { isOpenworkGatewayRuntime } from "./gateway-runtime";
import { readDesktopDistributionInfo } from "./desktop";

export function canCreateWorkspaces() {
  return !isOpenworkGatewayRuntime() && readDesktopDistributionInfo().localRuntimeEnabled;
}
