/** @jsxImportSource react */
import { useEffect, useId, useRef, useState, type SetStateAction } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OpenworkServerClient } from "@/app/lib/openwork-server";
import { t } from "@/i18n";
import {
  EnvironmentVariableProvider,
  type ApplyEnvironmentChangesResult,
  type EnvironmentEditorDraft,
  useEnvironmentVariableApplyChanges,
  useEnvironmentVariableList,
  useEnvironmentVariableModify,
  useEnvironmentVariableRemove,
  useIsEnvironmentVariableChangesPending,
} from "./environment-variable-provider";
import { SettingsNotice, Spinner } from "@/react-app/domains/settings/settings-section";
import {
  EnvironmentVariableTableItem,
  EnvironmentVariableTable,
  EnvironmentVariableTableBody,
  EnvironmentVariableTableEmpty,
  EnvironmentVariableTableHeader,
  EnvironmentVariableTableLoading,
  type EnvironmentVariableItem,
} from "./environment-variable-table";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItemFootnote,
  LayoutSectionTitle,
  LayoutStack,
} from "@/react-app/domains/settings/settings-layout";
import { ConfirmModal } from "@/react-app/design-system/modals/confirm-modal";
import { useCloudSession } from "../cloud/cloud-session-provider";
import { isDenOrgAdminRole } from "../../../../app/lib/den";

type EnvItem = EnvironmentVariableItem;
type EnvironmentEditorState = EnvironmentEditorDraft | null;

export type EnvironmentViewProps = {
  client: OpenworkServerClient | null;
  isRemoteWorkspace: boolean;
  onApplyChanges?: () => Promise<ApplyEnvironmentChangesResult>;
  applyBlocked?: boolean;
  applyBlockedReason?: string | null;
  runtimeKey?: string | null;
};

export function EnvironmentView(props: EnvironmentViewProps) {
  return (
    <EnvironmentVariableProvider
      client={props.client}
      runtimeKey={props.runtimeKey}
      onApplyChanges={props.onApplyChanges}
    >
      <EnvironmentViewContent {...props} />
    </EnvironmentVariableProvider>
  );
}

function EnvironmentViewContent(props: EnvironmentViewProps) {
  const cloudSession = useCloudSession();
  const { client, isRemoteWorkspace } = props;
  const canViewEnvironment = !cloudSession.isSignedIn
    || isDenOrgAdminRole(cloudSession.activeOrganization?.role);
  const canEdit = !isRemoteWorkspace && client !== null;
  const applyBlockedReason = props.applyBlocked
    ? props.applyBlockedReason ?? t("settings.environment.apply_blocked_active_tasks")
    : null;

  const [editor, setEditor] = useState<EnvironmentEditorState>(null);

  useEffect(() => {
    if (canEdit) {
      return;
    }
    setEditor(null);
  }, [canEdit]);

  if (!canViewEnvironment) {
    return (
      <LayoutStack>
        <SettingsNotice>{t("settings.environment.admin_only")}</SettingsNotice>
      </LayoutStack>
    );
  }

  return (
    <LayoutStack>
      <EnvironmentSettingsPanel
        client={client}
        isRemoteWorkspace={isRemoteWorkspace}
        canEdit={canEdit}
        runtimeKey={props.runtimeKey}
        onApplyChanges={props.onApplyChanges}
        applyBlocked={props.applyBlocked}
        applyBlockedReason={applyBlockedReason}
        editor={editor}
        onEditorChange={setEditor}
      />
    </LayoutStack>
  );
}

type EnvironmentSettingsPanelProps = {
  client: OpenworkServerClient | null;
  isRemoteWorkspace: boolean;
  canEdit: boolean;
  runtimeKey?: string | null;
  onApplyChanges?: () => Promise<ApplyEnvironmentChangesResult>;
  applyBlocked?: boolean;
  applyBlockedReason: string | null;
  editor: EnvironmentEditorState;
  onEditorChange: (value: SetStateAction<EnvironmentEditorState>) => void;
};

function EnvironmentSettingsPanel(props: EnvironmentSettingsPanelProps) {
  const isPendingChanges = useIsEnvironmentVariableChangesPending();
  const { data, error, isLoading } = useEnvironmentVariableList({
    client: props.client,
    isRemoteWorkspace: props.isRemoteWorkspace,
    runtimeKey: props.runtimeKey,
  });
  const [vaultAuthReason, setVaultAuthReason] = useState<"add" | "replace" | "delete" | null>(null);
  const vaultAuthResolver = useRef<((authorized: boolean) => void) | null>(null);

  const authorizeSecretMutation = (reason: "add" | "replace" | "delete") => {
    return new Promise<boolean>((resolve) => {
      vaultAuthResolver.current?.(false);
      vaultAuthResolver.current = resolve;
      setVaultAuthReason(reason);
    });
  };

  const finishVaultAuthorization = (authorized: boolean) => {
    vaultAuthResolver.current?.(authorized);
    vaultAuthResolver.current = null;
    setVaultAuthReason(null);
  };

  const openAdd = () => {
    if (!props.canEdit) {
      return;
    }
    void authorizeSecretMutation("add").then((authorized) => {
      if (authorized) props.onEditorChange({ mode: "add", key: "", value: "" });
    });
  };

  const openEdit = (item: EnvItem) => {
    if (!props.canEdit) {
      return;
    }
    void authorizeSecretMutation("replace").then((authorized) => {
      if (authorized) props.onEditorChange({ mode: "edit", key: item.key, value: "" });
    });
  };

  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <LayoutSectionTitle>{t("settings.environment.title")}</LayoutSectionTitle>
            <LayoutSectionDescription className="max-w-[52ch]">
              {t("settings.environment.description")}
            </LayoutSectionDescription>
          </div>
          {props.canEdit ? (
            <Button className="shrink-0" onClick={openAdd}>
              <Plus className="size-4" />
              {t("settings.environment.add_button")}
            </Button>
          ) : null}
        </div>
      </LayoutSectionHeader>

      {props.isRemoteWorkspace ? (
        <SettingsNotice>{t("settings.environment.remote_workspace_hint")}</SettingsNotice>
      ) : null}

      {error ? <SettingsNotice tone="error">{error.message}</SettingsNotice> : null}

      {isPendingChanges && !props.isRemoteWorkspace ? (
        <EnvironmentPendingChanges
          onApplyChanges={props.onApplyChanges}
          applyBlocked={props.applyBlocked}
          applyBlockedReason={props.applyBlockedReason}
        />
      ) : null}

      {!props.isRemoteWorkspace ? (
        <EnvironmentItemsTable
          loading={isLoading}
          items={data?.items ?? []}
          canEdit={props.canEdit}
          onAdd={openAdd}
          onEdit={openEdit}
          onAuthorizeDelete={() => authorizeSecretMutation("delete")}
        />
      ) : null}

      {!props.isRemoteWorkspace ? (
        <>
          <LayoutSectionItemFootnote>{t("settings.environment.footer_hint")}</LayoutSectionItemFootnote>
          <LayoutSectionItemFootnote>{t("settings.environment.override_hint")}</LayoutSectionItemFootnote>
        </>
      ) : null}

      {props.editor ? (
        <EnvironmentEditorModal
          editor={props.editor}
          onClose={() => props.onEditorChange(null)}
          onChange={props.onEditorChange}
        />
      ) : null}

      {vaultAuthReason ? (
        <SecretVaultAuthModal
          reason={vaultAuthReason}
          onResult={finishVaultAuthorization}
        />
      ) : null}
    </LayoutSection>
  );
}

type SecretVaultAuthStatus = {
  method: "touch-id" | "master-password";
  configured: boolean;
};

function SecretVaultAuthModal(props: {
  reason: "add" | "replace" | "delete";
  onResult: (authorized: boolean) => void;
}) {
  const [status, setStatus] = useState<SecretVaultAuthStatus | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const invokeDesktop = window.__OPENWORK_ELECTRON__?.invokeDesktop;
    if (!invokeDesktop) {
      setError(t("settings.environment.system_auth_required"));
      return;
    }
    void invokeDesktop("secretVaultAuthStatus")
      .then(setStatus)
      .catch((statusError) => {
        setError(statusError instanceof Error ? statusError.message : t("app.unknown_error"));
      });
  }, []);

  const submit = async () => {
    const invokeDesktop = window.__OPENWORK_ELECTRON__?.invokeDesktop;
    if (!invokeDesktop || !status || busy) return;
    setBusy(true);
    setError(null);
    try {
      let passwordForAuthorization: string | undefined;
      if (status.method === "master-password") {
        if (!status.configured) {
          if (password.length < 10) {
            throw new Error(t("settings.environment.password_too_short"));
          }
          if (password !== confirmation) {
            throw new Error(t("settings.environment.password_mismatch"));
          }
          await invokeDesktop("secretVaultConfigurePassword", password);
        }
        passwordForAuthorization = password;
      }
      const result = await invokeDesktop(
        "secretVaultAuthorize",
        props.reason,
        passwordForAuthorization,
      );
      if (!result.authorized) {
        throw new Error(t("settings.environment.system_auth_required"));
      }
      props.onResult(true);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t("app.unknown_error"));
    } finally {
      setBusy(false);
    }
  };

  const needsPassword = status?.method === "master-password";
  const needsConfirmation = needsPassword && status?.configured === false;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && props.onResult(false)}>
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.environment.vault_auth_title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {status?.method === "touch-id"
            ? t("settings.environment.touch_id_hint")
            : status?.configured === false
              ? t("settings.environment.create_vault_password")
              : t("settings.environment.enter_vault_password")}
        </p>
        {needsPassword ? (
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="renwork-vault-password">
                {t("settings.environment.vault_password_label")}
              </FieldLabel>
              <Input
                id="renwork-vault-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={status?.configured ? "current-password" : "new-password"}
                disabled={busy}
                autoFocus
              />
            </Field>
            {needsConfirmation ? (
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="renwork-vault-password-confirmation">
                  {t("settings.environment.confirm_vault_password")}
                </FieldLabel>
                <Input
                  id="renwork-vault-password-confirmation"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  disabled={busy}
                />
              </Field>
            ) : null}
          </FieldGroup>
        ) : null}
        {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}
        <DialogFooter>
          <DialogClose
            disabled={busy}
            render={<Button variant="outline" size="sm" disabled={busy} />}
          >
            {t("settings.environment.cancel")}
          </DialogClose>
          <Button size="sm" onClick={() => void submit()} disabled={busy || status === null}>
            <Spinner spinning={busy} />
            {t("settings.environment.authorize")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EnvironmentPendingChangesProps = {
  onApplyChanges?: () => Promise<ApplyEnvironmentChangesResult>;
  applyBlocked?: boolean;
  applyBlockedReason: string | null;
};

function EnvironmentPendingChanges(props: EnvironmentPendingChangesProps) {
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const { isApplying, error } = useEnvironmentVariableApplyChanges();

  return (
    <>
      <Alert variant="warning">
        <RefreshCw />
        <AlertTitle>{t("settings.environment.apply_pending_title")}</AlertTitle>
        <AlertDescription className="max-w-[54ch]">
          {props.onApplyChanges
            ? t("settings.environment.apply_pending_body")
            : t("settings.environment.apply_pending_body_manual")}
        </AlertDescription>
        {props.applyBlockedReason ? (
          <AlertDescription>{props.applyBlockedReason}</AlertDescription>
        ) : error ? (
          <SettingsNotice tone="error">{error.message}</SettingsNotice>
        ) : null}
        {props.onApplyChanges ? (
          <AlertAction>
            <Button
              size="sm"
              onClick={() => {
                if (props.applyBlocked) {
                  toast.warning(props.applyBlockedReason ?? t("settings.environment.apply_blocked_active_tasks"));
                  return;
                }
                setApplyConfirmOpen(true);
              }}
              disabled={isApplying || props.applyBlocked}
              title={props.applyBlockedReason ?? undefined}
            >
              <Spinner spinning={isApplying} />
              {isApplying ? t("settings.environment.applying") : t("settings.environment.apply_button")}
            </Button>
          </AlertAction>
        ) : null}
      </Alert>

      <EnvironmentApplyModal
        open={applyConfirmOpen}
        onCancel={() => setApplyConfirmOpen(false)}
        onSuccess={() => setApplyConfirmOpen(false)}
      />
    </>
  );
}

type EnvironmentItemsTableProps = {
  loading: boolean;
  items: EnvItem[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (item: EnvItem) => void;
  onAuthorizeDelete: () => Promise<boolean>;
};

function EnvironmentItemsTable(props: EnvironmentItemsTableProps) {
  const [deleteCandidate, setDeleteCandidate] = useState<EnvItem | null>(null);
  const { isRemoving } = useEnvironmentVariableRemove();

  if (props.loading && props.items.length === 0) {
    return <EnvironmentVariableTableLoading />;
  }
  if (props.items.length === 0) {
    return <EnvironmentVariableTableEmpty canAdd={props.canEdit} onAdd={props.onAdd} />;
  }
  return (
    <>
      <EnvironmentVariableTable>
        <EnvironmentVariableTableHeader />
        <EnvironmentVariableTableBody>
          {props.items.map((item) => (
            <EnvironmentVariableTableItem
              key={item.key}
              item={item}
              canEdit={props.canEdit}
              deleting={isRemoving && deleteCandidate?.key === item.key}
              onEdit={props.onEdit}
              onDelete={(candidate) => {
                void props.onAuthorizeDelete().then((authorized) => {
                  if (authorized) setDeleteCandidate(candidate);
                });
              }}
            />
          ))}
        </EnvironmentVariableTableBody>
      </EnvironmentVariableTable>

      <EnvironmentDeleteModal
        candidate={deleteCandidate}
        onCancel={() => setDeleteCandidate(null)}
        onSuccess={() => setDeleteCandidate(null)}
      />
    </>
  );
}

type EnvironmentEditorModalProps = {
  editor: EnvironmentEditorDraft;
  onClose: () => void;
  onChange: (value: SetStateAction<EnvironmentEditorState>) => void;
};

type EnvironmentEditorFieldsProps = {
  editor: EnvironmentEditorDraft;
  onChange: (value: SetStateAction<EnvironmentEditorDraft>) => void;
  disabled?: boolean;
  error?: Error | null;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
};

export function EnvironmentEditorFields(props: EnvironmentEditorFieldsProps) {
  const keyFieldId = useId();
  const valueFieldId = useId();

  return (
    <FieldGroup>
      <Field data-invalid={props.error ? true : undefined}>
        <FieldLabel htmlFor={keyFieldId}>{t("settings.environment.key_label")}</FieldLabel>
        <Input
          id={keyFieldId}
          value={props.editor.key}
          onChange={(event) =>
            props.onChange((current) => ({ ...current, key: event.target.value }))
          }
          disabled={props.editor.mode === "edit" || props.disabled}
          placeholder={props.keyPlaceholder ?? "ANTHROPIC_API_KEY"}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={props.error ? true : undefined}
        />
        <FieldDescription>{t("settings.environment.key_hint")}</FieldDescription>
      </Field>
      <Field data-invalid={props.error ? true : undefined}>
        <FieldLabel htmlFor={valueFieldId}>{t("settings.environment.value_label")}</FieldLabel>
        <Textarea
          id={valueFieldId}
          value={props.editor.value}
          onChange={(event) =>
            props.onChange((current) => ({ ...current, value: event.target.value }))
          }
          disabled={props.disabled}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder={props.valuePlaceholder}
          className="font-mono"
          aria-invalid={props.error ? true : undefined}
        />
        {props.error ? <FieldError>{props.error.message}</FieldError> : null}
      </Field>
    </FieldGroup>
  );
}

function EnvironmentEditorModal(props: EnvironmentEditorModalProps) {
  const { modifyAsync, isModifying, error } = useEnvironmentVariableModify();
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isModifying) {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModifying, props.onClose]);

  const submitEditor = () => {
    if (isModifying) {
      return;
    }

    void modifyAsync(props.editor, { onSuccess: props.onClose });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isModifying) {
          props.onClose();
        }
      }}
    >
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle id={titleId}>
            {props.editor.mode === "add" ? t("settings.environment.add_title") : t("settings.environment.edit_title")}
          </DialogTitle>
        </DialogHeader>

        <EnvironmentEditorFields
          editor={props.editor}
          onChange={(value) => {
            props.onChange((current) => {
              if (!current) return current;
              return typeof value === "function" ? value(current) : value;
            });
          }}
          disabled={isModifying}
          error={error}
          valuePlaceholder={
            props.editor.mode === "edit"
              ? t("settings.environment.replace_value_placeholder")
              : undefined
          }
        />

        <DialogFooter>
          <DialogClose
            disabled={isModifying}
            render={<Button variant="outline" size="sm" disabled={isModifying} />}
          >
            {t("settings.environment.cancel")}
          </DialogClose>
          <Button size="sm" onClick={submitEditor} disabled={isModifying}>
            {isModifying ? t("settings.environment.saving") : t("settings.environment.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EnvironmentDeleteModalProps = {
  candidate: EnvironmentVariableItem | null;
  onCancel: () => void;
  onSuccess: () => void;
};

export function EnvironmentDeleteModal(props: EnvironmentDeleteModalProps) {
  const { removeAsync, isRemoving } = useEnvironmentVariableRemove();

  return (
    <ConfirmModal
      open={props.candidate !== null}
      title={t("settings.environment.delete_title")}
      message={
        props.candidate
          ? t("settings.environment.confirm_delete").replace("{key}", props.candidate.key)
          : ""
      }
      confirmLabel={
        isRemoving ? t("settings.environment.deleting") : t("settings.environment.delete")
      }
      cancelLabel={t("settings.environment.cancel")}
      variant="danger"
      confirmButtonVariant="destructive"
      onConfirm={() => {
        if (!props.candidate) {
          return;
        }
        
        void removeAsync(props.candidate.key, { onSuccess: props.onSuccess });
      }}
      onCancel={() => {
        if (!isRemoving) {
          props.onCancel();
        }
      }}
    />
  );
}

type EnvironmentApplyModalProps = {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
};

export function EnvironmentApplyModal(props: EnvironmentApplyModalProps) {
  const { applyAsync, isApplying } = useEnvironmentVariableApplyChanges();

  return (
    <ConfirmModal
      open={props.open}
      title={t("settings.environment.apply_title")}
      message={t("settings.environment.apply_confirm_body")}
      confirmLabel={
        isApplying ? t("settings.environment.applying") : t("settings.environment.apply_button")
      }
      cancelLabel={t("settings.environment.cancel")}
      variant="warning"
      onConfirm={() => {
        void applyAsync(undefined, { onSuccess: props.onSuccess });
      }}
      onCancel={() => {
        if (!isApplying) {
          props.onCancel();
        }
      }}
    />
  );
}
