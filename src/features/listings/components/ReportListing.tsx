import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { FlagIcon, XIcon } from "../../../components/icons";
import { useAuthUser } from "../../../lib/auth";
import { useReportsEnabled } from "../../../lib/features";
import { supabase } from "../../../lib/supabase";

const REASONS = ["Scam or fraud", "Wrong or misleading details", "Already sold", "Inappropriate content", "Other"];

export function ReportListing({ listingId }: { listingId: string }) {
  const enabled = useReportsEnabled();
  const { data: user } = useAuthUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("listing_reports").insert({
        listing_id: listingId,
        reporter_id: user!.id,
        reason,
        details: details.trim() || null,
      });
      // unique (listing_id, reporter_id): a second report from the same person
      if (error?.code === "23505") throw new Error("You’ve already reported this listing.");
      if (error) throw error;
    },
  });

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-fg"
        onClick={() => {
          if (!user) {
            navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
            return;
          }
          send.reset();
          setOpen(true);
        }}
      >
        <FlagIcon size={16} />
        Report listing
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="card w-full max-w-md p-5 shadow-pop">
            <div className="flex items-start justify-between gap-4">
              <h2 id="report-title" className="text-lg font-semibold">Report this listing</h2>
              <button type="button" className="text-muted hover:text-fg" onClick={() => setOpen(false)} aria-label="Close">
                <XIcon />
              </button>
            </div>

            {send.isSuccess ? (
              <>
                <p className="mt-4 text-sm text-muted">Thanks — we’ll review this listing.</p>
                <div className="mt-4 flex justify-end">
                  <button type="button" className="btn-primary" onClick={() => setOpen(false)}>Done</button>
                </div>
              </>
            ) : (
              <>
                <label className="mt-4 block text-sm text-muted" htmlFor="report-reason">Reason</label>
                <select id="report-reason" className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <label className="mt-3 block text-sm text-muted" htmlFor="report-details">Details (optional)</label>
                <textarea id="report-details" className="input mt-1 min-h-[96px]" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
                {send.isError ? (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {send.error instanceof Error ? send.error.message : "Could not send the report."}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                  <button type="button" className="btn-primary" disabled={send.isPending} onClick={() => send.mutate()}>
                    {send.isPending ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
