"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { useAccounts, useSmsRules } from "@/lib/finance/hooks";
import {
  createSmsRule,
  deleteSmsRule,
  setSmsRuleEnabled,
  updateSmsRule,
} from "@/lib/finance/sms-rules-mutations";
import {
  canUseSmsImport,
  checkSmsImportPermission,
  requestSmsImportPermission,
} from "@/lib/sms-import";
import { AccountSelect } from "@/app/app/transactions/transaction-form-fields";
import { SettingsStatTile } from "@/app/app/settings/settings-stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const TOKEN_BUTTONS = [
  { token: "amount", label: "Amount" },
  { token: "balance", label: "Balance" },
  { token: "account", label: "Account" },
  { token: "date", label: "Date" },
  { token: "merchant", label: "Merchant" },
  { token: "*", label: "Ignore" },
] as const;

const PRESETS = [
  {
    key: "transfer-in",
    label: "Bank transfer received",
    kind: "income" as const,
    pattern:
      "Transfer Credit Rs {amount} To A/C No {account}. Balance available Rs {balance} - Thank you for banking with BOC",
  },
  {
    key: "pos-atm",
    label: "ATM cash withdrawal",
    kind: "transfer" as const,
    pattern:
      "POS/ATM Transaction Rs {amount} From A/C No {account}. Balance available Rs {balance} - Thank you for banking with BOC",
  },
  {
    key: "online-transfer-debit",
    label: "Online transfer sent",
    kind: "expense" as const,
    pattern:
      "Online Transfer Debit Rs {amount} From A/C No {account}. Balance available Rs {balance} - Thank you for banking with BOC",
  },
  {
    key: "transfer-out",
    label: "Outgoing bank transfer",
    kind: "expense" as const,
    pattern: "Fund transfer Successful. LKR {amount} to {merchant} on {date}. Call 1961",
  },
  {
    key: "card-purchase",
    label: "Card purchase",
    kind: "expense" as const,
    pattern:
      "Dear Cardholder, Purchase at {merchant} for LKR {amount} on {date} has been authorised on your debit card ending #{account}",
  },
] as const;

type RuleFormState = {
  label: string;
  senderMatch: string;
  accountId: string;
  kind: "income" | "expense" | "transfer";
  toAccountId: string;
  pattern: string;
  noteTemplate: string;
};

const EMPTY_FORM: RuleFormState = {
  label: "",
  senderMatch: "",
  accountId: "",
  kind: "expense",
  toAccountId: "",
  pattern: "",
  noteTemplate: "",
};

function insertToken(
  textarea: HTMLTextAreaElement | null,
  current: string,
  token: string,
  setValue: (v: string) => void,
) {
  const insertText = `{${token}}`;
  if (!textarea) {
    setValue(current + insertText);
    return;
  }
  const start = textarea.selectionStart ?? current.length;
  const end = textarea.selectionEnd ?? current.length;
  const next = `${current.slice(0, start)}${insertText}${current.slice(end)}`;
  setValue(next);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursor = start + insertText.length;
    textarea.setSelectionRange(cursor, cursor);
  });
}

function RuleFormFields({
  value,
  onChange,
  accounts,
}: {
  value: RuleFormState;
  onChange: (patch: Partial<RuleFormState>) => void;
  accounts: any[];
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  return (
    <DialogBody className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Label</Label>
        <Input
          placeholder="e.g. BOC - Transfer In"
          className="h-11"
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Sender ID
          </Label>
          <Input
            placeholder="e.g. BOC"
            className="h-11"
            value={value.senderMatch}
            onChange={(e) => onChange({ senderMatch: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Matched against the SMS sender shown on your phone (case-insensitive).
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            {value.kind === "transfer" ? "From Account" : "Account"}
          </Label>
          <AccountSelect
            accounts={accounts}
            value={value.accountId}
            onChange={(id) => onChange({ accountId: id })}
            label="Account"
            excludeId={value.kind === "transfer" ? value.toAccountId : undefined}
          />
        </div>
      </div>

      {value.kind === "transfer" && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            To Account
          </Label>
          <AccountSelect
            accounts={accounts}
            value={value.toAccountId}
            onChange={(id) => onChange({ toAccountId: id })}
            label="To Account"
            excludeId={value.accountId}
          />
          <p className="text-xs text-muted-foreground">
            Where the money ends up — e.g. Cash for an ATM withdrawal.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ kind: "expense" })}
            className={`motion-expressive press-expressive inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
              value.kind === "expense" ? "bg-rose-200/90 text-rose-900" : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowDownRight className="h-3.5 w-3.5" />
            Expense
          </button>
          <button
            type="button"
            onClick={() => onChange({ kind: "income" })}
            className={`motion-expressive press-expressive inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
              value.kind === "income" ? "bg-emerald-200/90 text-emerald-900" : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Income
          </button>
          <button
            type="button"
            onClick={() => onChange({ kind: "transfer" })}
            className={`motion-expressive press-expressive inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
              value.kind === "transfer" ? "bg-sky-200/90 text-sky-900" : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transfer
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Message Pattern
          </Label>
          <Select
            value=""
            onValueChange={(key) => {
              const preset = PRESETS.find((p) => p.key === key);
              if (!preset) return;
              onChange({ pattern: preset.pattern, kind: preset.kind });
            }}
          >
            <SelectTrigger className="h-7 w-auto gap-1 rounded-full border-0 bg-muted px-2.5 text-xs font-semibold shadow-none">
              <SelectValue placeholder="Start from a preset" />
            </SelectTrigger>
            <SelectContent align="end">
              {PRESETS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          ref={textareaRef}
          rows={4}
          placeholder="e.g. Transfer Credit Rs {amount} To A/C No {account}. Balance available Rs {balance}"
          value={value.pattern}
          onChange={(e) => onChange({ pattern: e.target.value })}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {TOKEN_BUTTONS.map((t) => (
            <button
              key={t.token}
              type="button"
              onClick={() => insertToken(textareaRef.current, value.pattern, t.token, (v) => onChange({ pattern: v }))}
              className="rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              +{t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Match the message&apos;s exact wording, replacing the parts that change with tokens.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
          Note Template (optional)
        </Label>
        <Input
          placeholder="e.g. Purchase at {merchant}"
          className="h-11"
          value={value.noteTemplate}
          onChange={(e) => onChange({ noteTemplate: e.target.value })}
        />
      </div>
    </DialogBody>
  );
}

function PermissionCard() {
  const [granted, setGranted] = React.useState<boolean | null>(null);
  const [checking, setChecking] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!canUseSmsImport()) {
      setGranted(null);
      return;
    }
    const result = await checkSmsImportPermission();
    setGranted(result);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!canUseSmsImport()) return null;

  const handleRequest = async () => {
    setChecking(true);
    try {
      const result = await requestSmsImportPermission();
      setGranted(result);
      if (!result) {
        toast.error("SMS permission denied", {
          description: "Real-time capture needs SMS access. You can still paste messages manually.",
        });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-medium">SMS Access</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Required for real-time capture. Without it, add messages manually from Transactions.
          </p>
        </div>
      </div>
      {granted ? (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Granted
        </Badge>
      ) : (
        <Button type="button" onClick={() => void handleRequest()} disabled={checking}>
          {checking ? "Requesting..." : "Grant Access"}
        </Button>
      )}
    </div>
  );
}

export function SmsRulesPanel() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { accounts } = useAccounts();
  const { smsRules, loading, error } = useSmsRules();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<RuleFormState>(EMPTY_FORM);
  const [edit, setEdit] = React.useState<any | null>(null);
  const [editForm, setEditForm] = React.useState<RuleFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [addingDefaults, setAddingDefaults] = React.useState(false);

  const accountById = React.useMemo(
    () => new Map((accounts as any[]).map((a) => [a.id, a])),
    [accounts],
  );

  const stats = React.useMemo(() => {
    const rules = smsRules as any[];
    return {
      total: rules.length,
      active: rules.filter((r) => r.enabled).length,
      disabled: rules.filter((r) => !r.enabled).length,
    };
  }, [smsRules]);

  React.useEffect(() => {
    if (createOpen && !createForm.accountId && (accounts as any[])[0]?.id) {
      setCreateForm((f) => ({ ...f, accountId: (accounts as any[])[0].id }));
    }
  }, [createOpen, createForm.accountId, accounts]);

  const submitCreate = async () => {
    if (!user) return;
    if (!createForm.label.trim() || !createForm.senderMatch.trim() || !createForm.accountId || !createForm.pattern.trim()) {
      toast.error("Fill in label, sender, account, and pattern");
      return;
    }
    if (createForm.kind === "transfer" && (!createForm.toAccountId || createForm.toAccountId === createForm.accountId)) {
      toast.error("Pick a destination account", { description: "It must differ from the from-account." });
      return;
    }
    setSubmitting(true);
    try {
      await createSmsRule(user.uid, {
        label: createForm.label.trim(),
        senderMatch: createForm.senderMatch.trim(),
        accountId: createForm.accountId,
        kind: createForm.kind,
        ...(createForm.kind === "transfer" ? { toAccountId: createForm.toAccountId } : {}),
        pattern: createForm.pattern.trim(),
        noteTemplate: createForm.noteTemplate.trim() || undefined,
      });
      toast.success("Rule added");
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    } catch (e) {
      toast.error("Failed to add rule", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!user || !edit) return;
    if (!editForm.label.trim() || !editForm.senderMatch.trim() || !editForm.accountId || !editForm.pattern.trim()) {
      toast.error("Fill in label, sender, account, and pattern");
      return;
    }
    if (editForm.kind === "transfer" && (!editForm.toAccountId || editForm.toAccountId === editForm.accountId)) {
      toast.error("Pick a destination account", { description: "It must differ from the from-account." });
      return;
    }
    setSubmitting(true);
    try {
      await updateSmsRule(user.uid, {
        ruleId: edit.id,
        label: editForm.label.trim(),
        senderMatch: editForm.senderMatch.trim(),
        accountId: editForm.accountId,
        kind: editForm.kind,
        ...(editForm.kind === "transfer" ? { toAccountId: editForm.toAccountId } : {}),
        pattern: editForm.pattern.trim(),
        noteTemplate: editForm.noteTemplate.trim() || undefined,
        enabled: edit.enabled,
      });
      toast.success("Rule updated");
      setEdit(null);
    } catch (e) {
      toast.error("Failed to update rule", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addDefaultRules = async () => {
    if (!user) return;
    const existingLabels = new Set((smsRules as any[]).map((r) => r.label));
    const missing = PRESETS.filter((p) => !existingLabels.has(p.label));
    if (!missing.length) {
      toast.info("All default rules are already added");
      return;
    }
    const defaultAccountId =
      (accounts as any[]).find((a) => a.type === "bank")?.id ??
      (accounts as any[]).find((a) => a.type === "card")?.id ??
      (accounts as any[])[0]?.id;
    if (!defaultAccountId) {
      toast.error("Add an account first", {
        description: "Default rules need an account to attach to.",
      });
      return;
    }
    const cashAccountId = (accounts as any[]).find((a) => a.type === "cash")?.id;
    const toCreate = missing.filter((preset) => preset.kind !== "transfer" || cashAccountId);
    const skippedForCash = missing.length - toCreate.length;

    setAddingDefaults(true);
    try {
      for (const preset of toCreate) {
        await createSmsRule(user.uid, {
          label: preset.label,
          senderMatch: "BOC",
          accountId: defaultAccountId,
          kind: preset.kind,
          ...(preset.kind === "transfer" ? { toAccountId: cashAccountId } : {}),
          pattern: preset.pattern,
        });
      }
      if (toCreate.length > 0) {
        toast.success(`Added ${toCreate.length} default rule${toCreate.length !== 1 ? "s" : ""}`, {
          description: "Edit any rule to change its sender or account.",
        });
      }
      if (skippedForCash > 0) {
        toast.info(`Skipped ${skippedForCash} rule${skippedForCash !== 1 ? "s" : ""} needing a Cash account`, {
          description: "Add a Cash account, then tap this again.",
        });
      }
    } catch (e) {
      toast.error("Failed to add default rules", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setAddingDefaults(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PermissionCard />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={addingDefaults}
          onClick={() => void addDefaultRules()}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {addingDefaults ? "Adding..." : "Add Default Rules"}
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Message Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Message Rule</DialogTitle>
              <DialogDescription>
                Teach Cashly to recognize a bank message shape and where it should apply.
              </DialogDescription>
            </DialogHeader>
            <RuleFormFields
              value={createForm}
              onChange={(patch) => setCreateForm((f) => ({ ...f, ...patch }))}
              accounts={accounts as any[]}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button disabled={submitting} onClick={() => void submitCreate()} className="min-w-24">
                {submitting ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <SettingsStatTile
          label="Total Rules"
          highlighted
          icon={MessageSquareText}
          iconWrapClassName="bg-primary/10"
          iconClassName="text-primary"
          value={stats.total}
          sub="message shapes recognized"
        />
        <SettingsStatTile
          label="Active"
          icon={CheckCircle2}
          iconWrapClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          value={stats.active}
          sub="rules currently matching"
        />
        <SettingsStatTile
          label="Disabled"
          icon={Pause}
          iconWrapClassName="bg-muted"
          iconClassName="text-muted-foreground"
          value={stats.disabled}
          sub="not currently matching"
        />
      </div>

      <Card className="surface-tonal">
        <CardHeader>
          <CardTitle>Message Rules</CardTitle>
          <CardDescription>
            Every match still lands in a review queue before it becomes a real transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-3xl" />
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-destructive">
              Failed to load rules{error?.message ? `: ${error.message}` : ""}
            </div>
          ) : (smsRules as any[]).length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {(smsRules as any[]).map((rule) => {
                const account = accountById.get(rule.accountId);
                const toAccount = rule.toAccountId ? accountById.get(rule.toAccountId) : null;
                const isIncome = rule.kind === "income";
                const isTransfer = rule.kind === "transfer";
                const Icon = isTransfer ? ArrowLeftRight : isIncome ? ArrowUpRight : ArrowDownRight;
                const isDisabled = !rule.enabled;

                return (
                  <div
                    key={rule.id}
                    className={`motion-expressive press-expressive elevation-1 min-w-0 rounded-3xl border bg-card/80 p-4 ${isDisabled ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            isTransfer ? "bg-sky-500/10" : isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${isTransfer ? "text-sky-600" : isIncome ? "text-emerald-600" : "text-rose-600"}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold">{rule.label}</h3>
                            {isDisabled && <Badge variant="secondary">Disabled</Badge>}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            From &ldquo;{rule.senderMatch}&rdquo; ·{" "}
                            {isTransfer
                              ? `${account?.name ?? "No account"} → ${toAccount?.name ?? "No account"}`
                              : (account?.name ?? "No account")}
                          </p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEdit(rule);
                              setEditForm({
                                label: rule.label ?? "",
                                senderMatch: rule.senderMatch ?? "",
                                accountId: rule.accountId ?? "",
                                kind:
                                  rule.kind === "income" || rule.kind === "transfer"
                                    ? rule.kind
                                    : "expense",
                                toAccountId: rule.toAccountId ?? "",
                                pattern: rule.pattern ?? "",
                                noteTemplate: rule.noteTemplate ?? "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              if (!user) return;
                              try {
                                await setSmsRuleEnabled(user.uid, rule.id, !rule.enabled);
                                toast.success(rule.enabled ? "Rule disabled" : "Rule enabled");
                              } catch (e) {
                                toast.error("Failed to update rule", {
                                  description: e instanceof Error ? e.message : undefined,
                                });
                              }
                            }}
                          >
                            {rule.enabled ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              if (!user) return;
                              if (!(await confirm({ title: "Delete this rule?", destructive: true }))) return;
                              try {
                                await deleteSmsRule(user.uid, rule.id);
                                toast.success("Rule deleted");
                              } catch (e) {
                                toast.error("Failed to delete rule", {
                                  description: e instanceof Error ? e.message : undefined,
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <p className="mt-3 truncate rounded-2xl bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {rule.pattern}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquareText className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No message rules yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add a rule for each bank message shape you want Cashly to recognize.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Message Rule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Message Rule</DialogTitle>
            <DialogDescription>Update the sender, account, or pattern.</DialogDescription>
          </DialogHeader>
          <RuleFormFields
            value={editForm}
            onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
            accounts={accounts as any[]}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={() => void submitEdit()} className="min-w-24">
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
