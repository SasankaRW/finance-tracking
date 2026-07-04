import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsStatTileProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  iconWrapClassName?: string;
  highlighted?: boolean;
}

export function SettingsStatTile({
  label,
  value,
  sub,
  icon: Icon,
  iconClassName,
  iconWrapClassName,
  highlighted = false,
}: SettingsStatTileProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-3 shadow-sm",
        highlighted && "border-primary/25 bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">
          {label}
        </p>
        {Icon ? (
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
              iconWrapClassName,
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
          </div>
        ) : null}
      </div>
      <div className="mt-2 truncate text-base font-bold tabular-nums sm:text-xl">{value}</div>
      {sub ? (
        <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground sm:text-xs">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
