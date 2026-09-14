"use client";

import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { deleteTransaction, restoreTransaction } from "@/lib/finance/mutations";
import { hapticError, hapticLight, hapticSuccess } from "@/lib/haptics";

// Shared by every place a transaction can be deleted (transactions list, swipe
// actions, the dashboard's Today list): confirm, delete, then an undo window —
// the confirm dialog stays as the primary safety net, the toast is a second
// one on top of it, not a replacement.
export function useDeleteTransactionWithUndo() {
  const { user } = useAuth();
  const confirm = useConfirm();

  return async (t: { id: string; updatedAt?: unknown }) => {
    if (!user) return;
    if (!(await confirm({ title: "Delete this transaction?", destructive: true }))) return;

    const uid = user.uid;
    try {
      await deleteTransaction(uid, t.id, t.updatedAt as any);
      void hapticSuccess();
      toast.success("Transaction deleted", {
        description: "Removed from your history.",
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () => {
            void hapticLight();
            restoreTransaction(uid, t.id).catch((e) => {
              toast.error("Couldn't undo the delete", {
                description: e instanceof Error ? e.message : undefined,
              });
            });
          },
        },
      });
    } catch (e) {
      void hapticError();
      toast.error("Failed to delete", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };
}
