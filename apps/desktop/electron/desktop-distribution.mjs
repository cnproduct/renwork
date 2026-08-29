export const STANDALONE_DESKTOP_DISTRIBUTION = Object.freeze({
  flavor: "standalone",
  appName: "RenWork",
  appIdentifier: "com.renrenyi.renwork",
  protocolScheme: "renwork",
  requireSignin: false,
  requireActivation: false,
});

export const PUBLIC_DESKTOP_DISTRIBUTION = Object.freeze({
  flavor: "public",
  appName: "RenWork",
  appIdentifier: "com.renrenyi.renwork",
  protocolScheme: "renwork",
  requireSignin: false,
  requireActivation: false,
});

export const CLOUD_DESKTOP_DISTRIBUTION = Object.freeze({
  flavor: "cloud",
  appName: "RenWork Cloud",
  appIdentifier: "com.renrenyi.renwork",
  protocolScheme: "renwork",
  requireSignin: true,
  requireActivation: false,
});

export const ENTERPRISE_DESKTOP_DISTRIBUTION = Object.freeze({
  flavor: "enterprise",
  appName: "RenWork Enterprise",
  appIdentifier: "com.renrenyi.renwork",
  protocolScheme: "renwork",
  requireSignin: true,
  requireActivation: true,
});

function normalizeFlavor(value) {
  const flavor = value?.trim().toLowerCase();
  if (flavor === "standalone") return "standalone";
  if (flavor === "public") return "public";
  if (flavor === "cloud") return "cloud";
  if (flavor === "enterprise") return "enterprise";
  return "standalone";
}

/**
 * Packaged builds trust only electron-builder's immutable package metadata.
 * The environment override exists solely so development and coded evals can
 * exercise the enterprise gate without producing a signed installer.
 */
export function resolveDesktopDistribution({
  isPackaged,
  packageFlavor,
  environmentFlavor,
}) {
  const flavor = normalizeFlavor(
    isPackaged ? packageFlavor : (environmentFlavor || packageFlavor),
  );
  if (flavor === "cloud") return CLOUD_DESKTOP_DISTRIBUTION;
  if (flavor === "enterprise") return ENTERPRISE_DESKTOP_DISTRIBUTION;
  if (flavor === "public") return PUBLIC_DESKTOP_DISTRIBUTION;
  return STANDALONE_DESKTOP_DISTRIBUTION;
}

export function enterpriseActivationComplete(config) {
  if (!config || typeof config !== "object") return false;
  const activation = config.enterpriseActivation;
  return Boolean(
    activation
    && typeof activation === "object"
    && typeof activation.activatedAt === "string"
    && activation.activatedAt.trim()
    && typeof activation.denBaseUrl === "string"
    && activation.denBaseUrl.trim(),
  );
}

export function desktopActivationRequired(distribution, config) {
  const requireActivation = distribution.flavor === "enterprise"
    ? distribution.requireActivation
    : (typeof config?.requireActivation === "boolean"
        ? config.requireActivation
        : distribution.requireActivation);
  return requireActivation && !enterpriseActivationComplete(config);
}

const ENTERPRISE_PREACTIVATION_COMMANDS = new Set([
  "__fetch",
  "appBuildInfo",
  "connectLinkAccept",
  "connectLinkVerify",
  "getDesktopBootstrapConfig",
  "setDesktopBootstrapConfig",
]);

export function enterprisePreactivationCommandAllowed(command) {
  return ENTERPRISE_PREACTIVATION_COMMANDS.has(command);
}
