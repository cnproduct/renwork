"use client";

import { ArrowRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useDenFlow } from "../../(den)/_providers/den-flow-provider";

export function AdminSignInStatus({ signedOutContent }: { signedOutContent: ReactNode }) {
  const router = useRouter();
  const { user, sessionHydrated, signOut } = useDenFlow();
  const [switchingAccount, setSwitchingAccount] = useState(false);

  if (!sessionHydrated) {
    return (
      <div className="grid gap-3" role="status" aria-live="polite">
        <p className="den-eyebrow">Platform administrator</p>
        <h1 className="den-title-lg">正在检查登录状态</h1>
        <p className="den-copy">请稍候，RenWork 正在确认当前浏览器会话。</p>
      </div>
    );
  }

  if (!user) {
    return signedOutContent;
  }

  const switchAccount = async () => {
    setSwitchingAccount(true);
    await signOut();
    setSwitchingAccount(false);
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <p className="den-eyebrow">Platform administrator</p>
        <h1 className="den-title-lg">已登录</h1>
        <p className="den-copy">
          当前账号：<span className="font-semibold text-[var(--dls-text-primary)]">{user.email}</span>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="den-button-primary w-full" onClick={() => router.replace("/admin")}>
          进入超级管理员后台
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="den-button-secondary w-full"
          disabled={switchingAccount}
          onClick={() => void switchAccount()}
        >
          <LogOut className="h-4 w-4" />
          {switchingAccount ? "正在退出…" : "切换管理员账号"}
        </button>
      </div>
      <p className="m-0 text-xs leading-5 text-[var(--dls-text-secondary)]">
        如果进入后台后提示没有权限，请切换为已加入平台管理员白名单的账号。
      </p>
    </div>
  );
}
