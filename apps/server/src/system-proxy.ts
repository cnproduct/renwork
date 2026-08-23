import { spawnSync } from "node:child_process";

export type SystemProxyEnv = {
  HTTP_PROXY?: string;
  http_proxy?: string;
  HTTPS_PROXY?: string;
  https_proxy?: string;
  ALL_PROXY?: string;
  all_proxy?: string;
  NO_PROXY?: string;
  no_proxy?: string;
};

/**
 * Automatically detects active system proxy settings on macOS, Windows, and Linux
 * when process.env does not already have explicit proxy variables set.
 *
 * This enables GUI-launched Electron desktop apps and spawned AI engine sidecars
 * (OpenCode, OpenAI, Anthropic, OpenCode Go) to seamlessly route traffic through
 * VPN / proxy clients (Clash, Surge, v2ray, Shadowrocket, Sing-box, etc.).
 */
export function detectSystemProxyEnv(env: NodeJS.ProcessEnv = process.env): SystemProxyEnv {
  if (
    env.HTTP_PROXY ||
    env.HTTPS_PROXY ||
    env.http_proxy ||
    env.https_proxy ||
    env.ALL_PROXY ||
    env.all_proxy
  ) {
    return {};
  }

  const proxyEnv: SystemProxyEnv = {};

  if (process.platform === "darwin") {
    try {
      const res = spawnSync("/usr/sbin/scutil", ["--proxy"], {
        encoding: "utf8",
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (res.status === 0 && res.stdout) {
        const out = res.stdout;
        const httpEnabled = /HTTPEnable\s*:\s*1/.test(out);
        const httpProxy = out.match(/HTTPProxy\s*:\s*([^\s]+)/)?.[1];
        const httpPort = out.match(/HTTPPort\s*:\s*(\d+)/)?.[1];

        const httpsEnabled = /HTTPSEnable\s*:\s*1/.test(out);
        const httpsProxy = out.match(/HTTPSProxy\s*:\s*([^\s]+)/)?.[1];
        const httpsPort = out.match(/HTTPSPort\s*:\s*(\d+)/)?.[1];

        const socksEnabled = /SOCKSEnable\s*:\s*1/.test(out);
        const socksProxy = out.match(/SOCKSProxy\s*:\s*([^\s]+)/)?.[1];
        const socksPort = out.match(/SOCKSPort\s*:\s*(\d+)/)?.[1];

        if (httpEnabled && httpProxy && httpPort) {
          proxyEnv.HTTP_PROXY = `http://${httpProxy}:${httpPort}`;
          proxyEnv.http_proxy = proxyEnv.HTTP_PROXY;
        }
        if (httpsEnabled && httpsProxy && httpsPort) {
          proxyEnv.HTTPS_PROXY = `http://${httpsProxy}:${httpsPort}`;
          proxyEnv.https_proxy = proxyEnv.HTTPS_PROXY;
        } else if (proxyEnv.HTTP_PROXY) {
          proxyEnv.HTTPS_PROXY = proxyEnv.HTTP_PROXY;
          proxyEnv.https_proxy = proxyEnv.HTTP_PROXY;
        }
        if (socksEnabled && socksProxy && socksPort) {
          proxyEnv.ALL_PROXY = `socks5://${socksProxy}:${socksPort}`;
          proxyEnv.all_proxy = proxyEnv.ALL_PROXY;
        }
        if (proxyEnv.HTTP_PROXY || proxyEnv.HTTPS_PROXY || proxyEnv.ALL_PROXY) {
          proxyEnv.NO_PROXY = "localhost,127.0.0.1,::1,*.local";
          proxyEnv.no_proxy = proxyEnv.NO_PROXY;
        }
      }
    } catch {
      // ignore
    }
  } else if (process.platform === "win32") {
    try {
      const res = spawnSync(
        "reg",
        ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", "ProxyEnable"],
        {
          encoding: "utf8",
          timeout: 2000,
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      if (res.status === 0 && /ProxyEnable\s+REG_DWORD\s+0x1/i.test(res.stdout ?? "")) {
        const serverRes = spawnSync(
          "reg",
          ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", "ProxyServer"],
          {
            encoding: "utf8",
            timeout: 2000,
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"],
          },
        );
        const serverMatch = (serverRes.stdout ?? "").match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/i);
        if (serverMatch?.[1]) {
          const rawServer = serverMatch[1].trim();
          if (rawServer.includes("=")) {
            for (const part of rawServer.split(";")) {
              const [proto, addr] = part.split("=");
              if (proto && addr) {
                const cleanProto = proto.trim().toLowerCase();
                const cleanAddr = addr.trim().startsWith("http") ? addr.trim() : `http://${addr.trim()}`;
                if (cleanProto === "http") {
                  proxyEnv.HTTP_PROXY = cleanAddr;
                  proxyEnv.http_proxy = cleanAddr;
                } else if (cleanProto === "https") {
                  proxyEnv.HTTPS_PROXY = cleanAddr;
                  proxyEnv.https_proxy = cleanAddr;
                } else if (cleanProto === "socks") {
                  proxyEnv.ALL_PROXY = addr.trim().startsWith("socks") ? addr.trim() : `socks5://${addr.trim()}`;
                  proxyEnv.all_proxy = proxyEnv.ALL_PROXY;
                }
              }
            }
          } else {
            const cleanAddr = rawServer.startsWith("http") ? rawServer : `http://${rawServer}`;
            proxyEnv.HTTP_PROXY = cleanAddr;
            proxyEnv.http_proxy = cleanAddr;
            proxyEnv.HTTPS_PROXY = cleanAddr;
            proxyEnv.https_proxy = cleanAddr;
          }
          if (proxyEnv.HTTP_PROXY || proxyEnv.HTTPS_PROXY || proxyEnv.ALL_PROXY) {
            proxyEnv.NO_PROXY = "localhost,127.0.0.1,::1";
            proxyEnv.no_proxy = proxyEnv.NO_PROXY;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return proxyEnv;
}
