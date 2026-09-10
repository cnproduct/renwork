/** @jsxImportSource react */
import {
  Page,
  PageBackground,
  PageDescription,
  PageHeader,
  PageTitle,
  PageTitlebarRegion,
} from "@/components/page";
import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";

type ProviderSelectionStepProps = {
  showOpenWorkModels?: boolean;
  onOpenWorkModels: () => void;
};

export function ProviderSelectionStep({
  showOpenWorkModels = true,
  onOpenWorkModels,
}: ProviderSelectionStepProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <PageBackground />
      <PageTitlebarRegion />

      <div className="relative z-10 mx-6 w-full max-w-md rounded-3xl border border-border bg-background px-8 py-10">
        <PageHeader className="mb-8 text-center">
          <PageTitle>Power your first task</PageTitle>
          <PageDescription>
            RenWork models are provisioned by the platform and every request is settled through RenCredit.
          </PageDescription>
        </PageHeader>

        <div className="space-y-3">
          {showOpenWorkModels ? (
            <button
              type="button"
              className="flex w-full items-start gap-4 rounded-xl border border-blue-7/50 bg-blue-2/30 p-4 text-left transition-colors hover:bg-blue-3/40"
              onClick={onOpenWorkModels}
            >
              <SparklesIcon className="mt-0.5 size-5 shrink-0 text-blue-10" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  Use RenWork Models
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Pay through RenWork Cloud and skip API key setup.
                </div>
              </div>
            </button>
          ) : null}

          {!showOpenWorkModels ? (
            <Button className="w-full" onClick={onOpenWorkModels}>
              Check RenWork model access
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
