import { AuthPanel } from "../../(den)/_components/auth-panel";
import { DenFlowProvider } from "../../(den)/_providers/den-flow-provider";
import { AdminSignInStatus } from "./status";

export default function AdminSignInPage() {
  return (
    <DenFlowProvider>
      <main className="den-page flex min-h-screen w-full items-center justify-center px-4 py-8">
        <section className="den-frame w-full max-w-xl overflow-hidden">
          <div className="border-b border-[var(--dls-border)] px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <img src="/renwork-mark.png" alt="RenWork" className="h-9 w-9 object-contain" />
              <div>
                <p className="m-0 text-base font-semibold text-[var(--dls-text-primary)]">RenWork</p>
                <p className="m-0 text-xs text-[var(--dls-text-secondary)]">平台超级管理员后台</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <AdminSignInStatus
              signedOutContent={(
                <AuthPanel
                  bare
                  initialMode="sign-in"
                  signInOnly
                  hideSocialAuth
                  authenticatedRedirectPath="/admin"
                  eyebrow="Platform administrator"
                  signInContent={{
                    title: "手动登录超级管理员",
                    copy: "请输入已加入平台管理员白名单的邮箱和密码。登录成功后会自动返回后台。",
                    submitLabel: "登录并打开后台",
                  }}
                />
              )}
            />
          </div>
        </section>
      </main>
    </DenFlowProvider>
  );
}
