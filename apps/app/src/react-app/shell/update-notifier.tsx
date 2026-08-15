import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export function UpdateNotifier() {
  const navigate = useNavigate();
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.__OPENWORK_ELECTRON__?.updater) {
      return;
    }

    const updater = window.__OPENWORK_ELECTRON__.updater;

    const checkForUpdates = async () => {
      try {
        const result = await updater.check?.();
        if (result?.available && result.latestVersion && !hasNotifiedRef.current) {
          hasNotifiedRef.current = true;
          toast.info(`🚀 发现 RenWork 新版本 v${result.latestVersion}`, {
            description: `当前版本 v${result.currentVersion || ""}，建议及时更新以获取最新功能与修复。`,
            duration: 20000,
            action: {
              label: "前往更新",
              onClick: () => {
                navigate("/settings/general");
              },
            },
          });
        }
      } catch (err) {
        console.warn("[updater] Background check failed:", err);
      }
    };

    // First check 6 seconds after launch
    const initialTimer = setTimeout(() => {
      void checkForUpdates();
    }, 6000);

    // Periodic check every 2 hours
    const intervalTimer = setInterval(() => {
      void checkForUpdates();
    }, 2 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [navigate]);

  return null;
}
