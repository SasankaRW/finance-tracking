"use client";

import * as React from "react";
import { Check, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

type NumpadProps = {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  className?: string;
};

function NumpadButton({
  children,
  onClick,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "motion-expressive press-expressive flex aspect-square w-full items-center justify-center rounded-full bg-card text-2xl font-semibold shadow-sm transition-all active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Numpad({
  onDigit,
  onBackspace,
  onConfirm,
  confirmDisabled,
  confirmLoading,
  className,
}: NumpadProps) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0"];

  return (
    <div className={cn("animate-ios-in grid grid-cols-4 gap-2 sm:gap-3", className)}>
      {keys.slice(0, 3).map((key) => (
        <NumpadButton key={key} onClick={() => onDigit(key)} ariaLabel={key}>
          {key}
        </NumpadButton>
      ))}
      <NumpadButton
        onClick={onBackspace}
        ariaLabel="Backspace"
        className="bg-violet-200/80 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
      >
        <Delete className="h-6 w-6" />
      </NumpadButton>

      {keys.slice(3, 6).map((key) => (
        <NumpadButton key={key} onClick={() => onDigit(key)} ariaLabel={key}>
          {key}
        </NumpadButton>
      ))}
      <button
        type="button"
        disabled={confirmDisabled || confirmLoading}
        onClick={onConfirm}
        aria-label="Save transaction"
        className="motion-expressive press-expressive row-span-2 flex items-center justify-center rounded-[2rem] bg-sky-300 text-sky-950 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 dark:bg-sky-600 dark:text-white"
      >
        {confirmLoading ? (
          <span className="text-sm font-bold">…</span>
        ) : (
          <Check className="h-8 w-8 stroke-[2.5]" />
        )}
      </button>

      {keys.slice(6, 9).map((key) => (
        <NumpadButton key={key} onClick={() => onDigit(key)} ariaLabel={key}>
          {key}
        </NumpadButton>
      ))}

      <NumpadButton onClick={() => onDigit(".")} ariaLabel="Decimal">
        .
      </NumpadButton>
      <NumpadButton onClick={() => onDigit("0")} ariaLabel="0">
        0
      </NumpadButton>
      <div className="aspect-square" aria-hidden />
    </div>
  );
}

export function appendNumpadDigit(current: string, digit: string) {
  if (digit === ".") {
    if (current.includes(".")) return current;
    return current ? `${current}.` : "0.";
  }
  if (current === "0" && digit !== ".") return digit;
  const next = current + digit;
  const [, decimals] = next.split(".");
  if (decimals && decimals.length > 2) return current;
  if (next.replace(".", "").length > 12) return current;
  return next;
}

export function backspaceNumpad(current: string) {
  if (current.length <= 1) return "";
  return current.slice(0, -1);
}
