"use client";

import * as React from "react";
import { toast } from "sonner";
import { MailPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { ingestRawMessage } from "@/lib/finance/sms-import-mutations";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Manual fallback for capturing a bank message: paste text that was missed by
// the native SMS receiver (e.g. sent before permission was granted), or
// received on a platform that can't read SMS at all (web/desktop). Feeds into
// the same review queue as the native path via ingestRawMessage.
export function PasteMessageDialog({
  open,
  onOpenChange,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const [sender, setSender] = React.useState("");
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (!user || !body.trim()) return;
    setSubmitting(true);
    try {
      await ingestRawMessage(user.uid, {
        sender: sender.trim() || undefined,
        body: body.trim(),
        receivedAt: new Date(),
      });
      toast.success("Message added for review");
      setBody("");
      setSender("");
      setDialogOpen(false);
    } catch (e) {
      toast.error("Failed to add message", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <MailPlus className="h-4 w-4 mr-2" />
            Add from message
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add from Message</DialogTitle>
          <DialogDescription>
            Paste a bank SMS to queue it for review, using your configured message rules.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Sender (optional)
            </Label>
            <Input
              placeholder="e.g. BOC"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Message text
            </Label>
            <Textarea
              placeholder="Paste the full SMS text here"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!body.trim() || submitting} onClick={() => void submit()} className="min-w-24">
            {submitting ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
