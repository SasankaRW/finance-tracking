"use client";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
};

// Shared edit/delete (etc.) row menu used by list/table rows across accounts, categories,
// transactions, budgets, and subscriptions — kept as one component so the trigger's hover/focus
// reveal behavior and each item's styling stay in sync everywhere it's used.
export function RowActionsMenu({
  ariaLabel,
  actions,
  triggerClassName = "p-0",
}: {
  ariaLabel: string;
  actions: RowAction[];
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-touch" aria-label={ariaLabel} className={triggerClassName}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
              onClick={action.onClick}
            >
              <Icon className="h-4 w-4 mr-2" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
