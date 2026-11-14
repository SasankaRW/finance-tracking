import * as React from "react";

/**
 * Icons: Material Symbols Rounded, self-hosted and cut down to the glyphs used here (scripts/icons.py).
 * Same exported names as the lucide icons they replace, so call sites keep their `className="h-4 w-4"`.
 * Weight 500; filled when `filled` (or inside an active nav item via `.on`).
 */
export type IconProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  size?: number | string;
  filled?: boolean;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
};
export type LucideIcon = React.ComponentType<IconProps>;

/** `h-4`/`size-5`/`h-3.5` etc. in a className give the pixel size (Tailwind spacing x4); else 20. */
function sizeFrom(className: string | undefined, size: number | string | undefined): number | string {
  if (size !== undefined) return size;
  const m = className?.match(/(?:^|\s)(?:size|h)-(\d+(?:\.\d+)?)(?=\s|$)/);
  if (m) return parseFloat(m[1]) * 4;
  const a = className?.match(/(?:^|\s)(?:size|h)-\[(\d+)px\]/);
  if (a) return parseInt(a[1], 10);
  return 20;
}

export function Symbol({
  name,
  size,
  filled,
  className = "",
  style,
  strokeWidth: _sw,
  absoluteStrokeWidth: _asw,
  ...rest
}: IconProps & { name: string }) {
  const px = sizeFrom(className, size);
  const label = rest["aria-label"];
  return (
    <span
      className={`ms ${filled ? "fill" : ""} ${className}`}
      style={{ fontSize: typeof px === "number" ? px + 2 : px, ...style }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      {...rest}
    >
      {name}
    </span>
  );
}

function make(name: string, displayName: string) {
  const Icon = (props: IconProps) => <Symbol name={name} {...props} />;
  Icon.displayName = displayName;
  return Icon;
}

export const AlertCircle = make("error", "AlertCircle");
export const AlertTriangle = make("warning", "AlertTriangle");
export const Archive = make("archive", "Archive");
export const ArrowDownLeft = make("south_west", "ArrowDownLeft");
export const ArrowDownRight = make("south_east", "ArrowDownRight");
export const ArrowLeft = make("arrow_back", "ArrowLeft");
export const ArrowLeftRight = make("swap_horiz", "ArrowLeftRight");
export const ArrowRight = make("arrow_forward", "ArrowRight");
export const ArrowUpRight = make("north_east", "ArrowUpRight");
export const Banknote = make("payments", "Banknote");
export const BarChart3 = make("bar_chart", "BarChart3");
export const Building2 = make("apartment", "Building2");
export const Calendar = make("calendar_month", "Calendar");
export const CalendarIcon = Calendar;
export const Check = make("check", "Check");
export const CheckCircle2 = make("check_circle", "CheckCircle2");
export const CheckIcon = Check;
export const ChevronDownIcon = make("keyboard_arrow_down", "ChevronDownIcon");
export const ChevronLeft = make("chevron_left", "ChevronLeft");
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRight = make("chevron_right", "ChevronRight");
export const ChevronRightIcon = ChevronRight;
export const ChevronUpIcon = make("keyboard_arrow_up", "ChevronUpIcon");
export const CircleCheckIcon = make("check_circle", "CircleCheckIcon");
export const CircleIcon = make("circle", "CircleIcon");
export const Clock = make("schedule", "Clock");
export const CreditCard = make("credit_card", "CreditCard");
/** Backspace key in the numpad (not a destructive action). */
export const Delete = make("backspace", "Delete");
export const Download = make("download", "Download");
export const EyeOff = make("visibility_off", "EyeOff");
export const Filter = make("filter_list", "Filter");
export const Fingerprint = make("fingerprint", "Fingerprint");
export const HandCoins = make("volunteer_activism", "HandCoins");
export const InfoIcon = make("info", "InfoIcon");
export const Layers = make("dashboard", "Layers");
export const List = make("receipt_long", "List");
export const Loader2Icon = make("progress_activity", "Loader2Icon");
export const Lock = make("lock", "Lock");
export const LockKeyhole = make("lock", "LockKeyhole");
export const LogOut = make("logout", "LogOut");
export const MapPin = make("location_on", "MapPin");
export const MoreHorizontal = make("more_horiz", "MoreHorizontal");
export const OctagonXIcon = make("dangerous", "OctagonXIcon");
export const Palette = make("palette", "Palette");
export const Pause = make("pause", "Pause");
export const Pencil = make("edit", "Pencil");
export const PiggyBank = make("savings", "PiggyBank");
export const Play = make("play_arrow", "Play");
export const Plus = make("add", "Plus");
export const Receipt = make("receipt", "Receipt");
export const Repeat = make("repeat", "Repeat");
export const RotateCcw = make("undo", "RotateCcw");
export const Scale = make("balance", "Scale");
export const Search = make("search", "Search");
export const Settings = make("settings", "Settings");
export const Settings2 = make("tune", "Settings2");
export const ShieldCheck = make("verified_user", "ShieldCheck");
export const Smartphone = make("smartphone", "Smartphone");
export const StickyNote = make("sticky_note_2", "StickyNote");
export const Tag = make("sell", "Tag");
export const Target = make("target", "Target");
export const Trash2 = make("delete", "Trash2");
export const TrendingDown = make("trending_down", "TrendingDown");
export const TrendingUp = make("trending_up", "TrendingUp");
export const TriangleAlertIcon = make("warning", "TriangleAlertIcon");
export const Wallet = make("account_balance_wallet", "Wallet");
export const X = make("close", "X");
export const XIcon = X;
export const CalendarDays = make("calendar_view_day", "CalendarDays");
export const Eye = make("visibility", "Eye");
export const Landmark = make("account_balance", "Landmark");
export const PieChart = make("pie_chart", "PieChart");
export const MessageSquareText = make("sms", "MessageSquareText");
export const ShieldAlert = make("gpp_maybe", "ShieldAlert");
export const Sparkles = make("auto_awesome", "Sparkles");
export const MailPlus = make("mark_email_unread", "MailPlus");
export const ChevronDown = make("keyboard_arrow_down", "ChevronDown");
export const CalendarClock = make("event_upcoming", "CalendarClock");
export const Home = make("home", "Home");
