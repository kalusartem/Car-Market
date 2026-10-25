import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { errorMessage } from "../../../lib/errors";

type Props = {
  open: boolean;
  onClose: () => void;
  listingId: string;
  sellerId: string;
};

export function ContactSellerModal({
  open,
  onClose,
  listingId,
  sellerId,
}: Props) {
  // ✅ hooks are always called; render can be conditional
  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data?.user?.id ?? null;
    },
    staleTime: 30_000,
  });

  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please sign in to contact sellers.");
      if (!listingId) throw new Error("Missing listing id.");
      if (!message.trim()) throw new Error("Please enter a message.");

      const { error } = await supabase.from("inquiries").insert({
        listing_id: listingId,
        buyer_id: userId,
        seller_id: sellerId,
        message: message.trim(),
      });

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      setNotice("Message sent!");
      setMessage("");
      // close after a moment; keep it simple + reliable
      setTimeout(() => onClose(), 600);
    },
    onError: (e: unknown) => {
      setNotice(errorMessage(e, "Could not send message."));
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay px-4"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-line bg-bg p-5 text-fg shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Contact seller</h2>
            <p className="text-sm text-subtle mt-1">
              Send a message to the seller about this listing.
            </p>
          </div>
          <button
            className="text-muted hover:text-fg"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {notice ? (
          <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-fg">
            {notice}
          </div>
        ) : null}

        <div className="mt-4">
          <label className="text-sm text-muted">Message</label>
          <textarea
            className="mt-2 w-full rounded-xl border border-line bg-surface p-3 text-fg placeholder:text-subtle outline-none focus:border-line-strong min-h-[120px]"
            placeholder={
              userId
                ? "Hi! Is this still available? Can we schedule a time to see it?"
                : "Please sign in to send a message."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={send.isPending}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3"
            onClick={onClose}
            type="button"
            disabled={send.isPending}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg disabled:opacity-50"
            onClick={() => {
              setNotice(null);
              if (!userId) {
                setNotice("Please sign in to contact sellers.");
                return;
              }
              send.mutate();
            }}
            type="button"
            disabled={send.isPending}
          >
            {send.isPending ? "Sending…" : "Send message"}
          </button>
        </div>
      </div>
    </div>
  );
}
