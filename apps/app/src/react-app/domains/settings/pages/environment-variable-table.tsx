/** @jsxImportSource react */
import type { ReactNode } from "react";
import { LockKeyhole, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { Spinner } from "../settings-section";

export type EnvironmentVariableItem = {
  key: string;
  value?: string;
  hasValue: boolean;
  updatedAt: number;
};

const MASKED_VALUE_DISPLAY = "••••••••";

function formatUpdatedAt(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
}

export type EnvironmentVariableTableProps = {
  className?: string;
  children: ReactNode;
};

export function EnvironmentVariableTable({ className, children }: EnvironmentVariableTableProps) {
  return (
    <Card variant="outline" className={cn("w-full p-0 rounded-xl", className)}>
      <CardContent className="p-0">
        <Table>{children}</Table>
      </CardContent>
    </Card>
  );
}

export function EnvironmentVariableTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-1/3">{t("settings.environment.key_label")}</TableHead>
        <TableHead>{t("settings.environment.value_label")}</TableHead>
        <TableHead className="text-right"><span className="sr-only">{t("settings.environment.table_actions")}</span></TableHead>
      </TableRow>
    </TableHeader>
  );
}

export type EnvironmentVariableTableBodyProps = {
  children: ReactNode;
};

export function EnvironmentVariableTableBody({ children }: EnvironmentVariableTableBodyProps) {
  return <TableBody>{children}</TableBody>;
}

export type EnvironmentVariableTableEditButtonProps = {
  onEdit: () => void;
};

export function EnvironmentVariableTableEditButton(props: EnvironmentVariableTableEditButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={props.onEdit}
            aria-label={t("common.edit")}
          >
            <Pencil aria-hidden="true" />
          </Button>
        )}
      />
      <TooltipContent>{t("settings.environment.click_to_edit")}</TooltipContent>
    </Tooltip>
  );
}

export type EnvironmentVariableTableDeleteButtonProps = {
  deleting: boolean;
  onDelete: () => void;
};

export function EnvironmentVariableTableDeleteButton(props: EnvironmentVariableTableDeleteButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={props.onDelete}
            disabled={props.deleting}
            aria-label={t("settings.environment.delete")}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      />
      <TooltipContent>{t("settings.environment.delete")}</TooltipContent>
    </Tooltip>
  );
}

export type EnvironmentVariableTableItemProps = {
  item: EnvironmentVariableItem;
  canEdit: boolean;
  deleting: boolean;
  onEdit: (item: EnvironmentVariableItem) => void;
  onDelete: (item: EnvironmentVariableItem) => void;
};

export function EnvironmentVariableTableItem(props: EnvironmentVariableTableItemProps) {
  const updatedLabel = formatUpdatedAt(props.item.updatedAt);

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {props.canEdit ? (
            <Button
              variant="link"
              className="h-auto w-full justify-start truncate p-0 font-mono text-sm font-medium text-foreground"
              onClick={() => props.onEdit(props.item)}
            >
              {props.item.key}
            </Button>
          ) : (
            <span className="truncate font-mono text-sm font-medium">{props.item.key}</span>
          )}
          {updatedLabel ? (
            <span className="text-xs text-muted-foreground">
              {t("settings.environment.updated_at").replace("{date}", updatedLabel)}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="h-full flex items-center justify-start">
          {props.item.hasValue ? (
            <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              {MASKED_VALUE_DISPLAY}
              <span className="font-sans">{t("settings.environment.secure_value")}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("settings.environment.empty_value")}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {props.canEdit ? (
            <>
              <EnvironmentVariableTableEditButton onEdit={() => props.onEdit(props.item)} />
              <EnvironmentVariableTableDeleteButton
                deleting={props.deleting}
                onDelete={() => props.onDelete(props.item)}
              />
            </>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export type EnvironmentVariableTableEmptyProps = {
  canAdd: boolean;
  onAdd: () => void;
};

export function EnvironmentVariableTableEmpty(props: EnvironmentVariableTableEmptyProps) {
  return (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyTitle>{t("settings.environment.empty_title")}</EmptyTitle>
        <EmptyDescription>
          {t("settings.environment.empty_body")}
        </EmptyDescription>
      </EmptyHeader>
      {props.canAdd ? (
        <EmptyContent>
          <Button onClick={props.onAdd}>
            <Plus className="size-4" />
            {t("settings.environment.add_button")}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function EnvironmentVariableTableLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Spinner />
      {t("settings.environment.loading")}
    </div>
  );
}
