import Link from "next/link";
import { RenWorkModelCatalogAdmin } from "../../../components/renwork-model-catalog-admin";

export default function ModelCatalogAdminPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 pb-5">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-orange-600">RenWork Control Center</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">模型与 RenCredit</h1>
          <p className="mt-1 text-sm text-slate-600">一个后台配置供应商、模型路由和用户计费展示。</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50"
        >
          返回超级管理员首页
        </Link>
      </div>
      <RenWorkModelCatalogAdmin />
    </main>
  );
}
