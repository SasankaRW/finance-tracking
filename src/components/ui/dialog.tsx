"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      // No backdrop-blur here: animating opacity on a blurred layer forces a
      // full re-blur every frame, which is what made this feel janky on
      // mobile WebView — a plain dim is instant to composite either way.
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/65 duration-200 ease-ios",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Drag-to-dismiss thresholds for the grabber below. Below sm, every dialog is
// a bottom sheet, so this lives in the shared primitive rather than being
// reimplemented per dialog.
const DRAG_DISMISS_PX = 110
const DRAG_DISMISS_VELOCITY = 0.6 // px/ms
const DRAG_FLING_MS = 220

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const hiddenCloseRef = React.useRef<HTMLButtonElement>(null)
  const dragStateRef = React.useRef<{ startY: number; startTime: number } | null>(null)
  const [dragY, setDragY] = React.useState(0)
  const [flinging, setFlinging] = React.useState(false)

  const onGrabberPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = { startY: e.clientY, startTime: performance.now() }
    setFlinging(false)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onGrabberPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return
    setDragY(Math.max(0, e.clientY - dragStateRef.current.startY))
  }

  const endGrabberDrag = () => {
    const state = dragStateRef.current
    dragStateRef.current = null
    if (!state) return

    const elapsed = Math.max(1, performance.now() - state.startTime)
    const velocity = dragY / elapsed

    if (dragY > DRAG_DISMISS_PX || velocity > DRAG_DISMISS_VELOCITY) {
      // Finish the gesture as a smooth fling off-screen, then let Radix
      // actually close/unmount once that's done — driving the exit from the
      // CSS animate-out classes instead would restart from their own keyframe
      // values and visibly snap back to center first.
      setFlinging(true)
      setDragY(1200)
      window.setTimeout(() => hiddenCloseRef.current?.click(), DRAG_FLING_MS)
    } else {
      setDragY(0)
    }
  }

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // No will-change-transform: forcing a persistent GPU layer on a
          // rounded + overflow-clipping element is exactly the combination
          // that caused the hero card's corner-clip bug earlier this session.
          // The drag-to-dismiss gesture below still transforms this element
          // via inline style just fine without the hint declared up front.
          "surface-tonal elevation-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-top-2 sm:data-[state=open]:slide-in-from-top-2 fixed bottom-0 left-[50%] z-50 grid max-h-[92dvh] w-full translate-x-[-50%] overflow-y-auto rounded-t-[2rem] border border-b-0 duration-[250ms] ease-ios outline-none sm:top-[50%] sm:bottom-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:translate-y-[-50%] sm:rounded-3xl sm:border",
          className
        )}
        style={
          dragY > 0
            ? {
                transform: `translate(-50%, ${dragY}px)`,
                transition: flinging
                  ? `transform ${DRAG_FLING_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
                  : "none",
              }
            : undefined
        }
        {...props}
      >
        {/* Drag handle: mobile-only (every dialog below sm is a bottom sheet).
            Scoped to just this small bar, not the whole header, so it never
            steals a drag from scrollable content or the close/title area. */}
        <div
          onPointerDown={onGrabberPointerDown}
          onPointerMove={onGrabberPointerMove}
          onPointerUp={endGrabberDrag}
          onPointerCancel={endGrabberDrag}
          className="flex shrink-0 touch-none cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing sm:hidden"
        >
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring press-expressive motion-expressive absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 opacity-90 transition-all hover:bg-secondary hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none sm:top-4 sm:right-4 sm:h-8 sm:w-8 [&_svg]:pointer-events-none [&_svg]:shrink-0"
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {/* Always present regardless of showCloseButton — the fling-dismiss
            above needs a Close to trigger programmatically. */}
        <DialogPrimitive.Close ref={hiddenCloseRef} tabIndex={-1} aria-hidden="true" className="hidden" />
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 p-4 pb-2 pr-14 text-left sm:p-6 sm:pb-0 sm:text-left", className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("px-4 py-3 sm:px-6 sm:py-4", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 border-t bg-background/85 p-4 pt-3 backdrop-blur sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-6 sm:pt-0 sm:backdrop-blur-none",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-display text-lg leading-none font-bold tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
