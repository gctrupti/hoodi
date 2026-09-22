import { inr } from "@/lib/hoodi/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Printer, ShieldCheck, MapPin, CheckCircle2 } from "lucide-react";

interface RequestReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    is_paid?: boolean;
    estimated_fare?: number | null;
    final_fare?: number | null;
    commission_amount?: number | null;
    payment_id?: string | null;
    created_at: string;
    completed_at?: string | null;
    address_text?: string | null;
    pickup_name?: string | null;
    pickup_address?: string | null;
    dropoff_name?: string | null;
    dropoff_address?: string | null;
    requester?: { name?: string | null } | null;
    helper?: { name?: string | null } | null;
  };
}

export function RequestReceiptModal({ open, onOpenChange, request }: RequestReceiptModalProps) {
  const fare = request.final_fare ?? request.estimated_fare ?? 0;
  const platformFee = Math.round(fare * 0.15);
  const helperPayout = fare - platformFee;
  const invoiceNumber = `INV-${request.id.slice(0, 8).toUpperCase()}`;
  const issueDate = request.completed_at
    ? new Date(request.completed_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date(request.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card p-0 sm:rounded-3xl overflow-hidden border border-border shadow-2xl print:m-0 print:border-none print:shadow-none">
        {/* Receipt Header Banner */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground font-display font-black text-xl shadow-xs">
              H
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold text-ink">Hoodi Errand Receipt</DialogTitle>
              <DialogDescription className="text-xs text-ink-soft">
                Official neighborhood service transaction record
              </DialogDescription>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-urgency-normal-soft px-3 py-1 text-xs font-semibold text-urgency-normal border border-urgency-normal/30">
            <CheckCircle2 className="h-3.5 w-3.5" /> Paid & Settled
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-sand/40 border border-border/80 text-xs">
            <div>
              <div className="text-ink-soft font-medium">Invoice No.</div>
              <div className="font-mono font-bold text-ink mt-0.5">{invoiceNumber}</div>
            </div>
            <div>
              <div className="text-ink-soft font-medium">Date</div>
              <div className="font-semibold text-ink mt-0.5">{issueDate}</div>
            </div>
            <div>
              <div className="text-ink-soft font-medium">Requester</div>
              <div className="font-semibold text-ink mt-0.5">{request.requester?.name ?? "Neighbor"}</div>
            </div>
            <div>
              <div className="text-ink-soft font-medium">Helper</div>
              <div className="font-semibold text-ink mt-0.5">{request.helper?.name ?? "Assigned Helper"}</div>
            </div>
          </div>

          {/* Task Summary */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1.5">Task Description</div>
            <div className="font-display text-base font-bold text-ink">{request.title}</div>
            {request.description && (
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">{request.description}</p>
            )}
          </div>

          {/* Location Summary */}
          {(request.pickup_address || request.dropoff_address || request.address_text) && (
            <div className="space-y-2 rounded-2xl border border-border/70 bg-background/50 p-3 text-xs">
              {request.pickup_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-clay shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-ink">Pickup: </span>
                    <span className="text-ink-soft">{request.pickup_name ? `${request.pickup_name}, ` : ""}{request.pickup_address}</span>
                  </div>
                </div>
              )}
              {(request.dropoff_address || request.address_text) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-ink">Delivery / Spot: </span>
                    <span className="text-ink-soft">{request.dropoff_name ? `${request.dropoff_name}, ` : ""}{request.dropoff_address ?? request.address_text}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Itemized Fare Breakdown */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2">Payment Breakdown</div>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-sand/60 border-b border-border text-ink-soft">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Description</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-ink">Base Errand & Assistance Fee</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink">{inr(fare)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-ink-soft text-[11px] pl-6">
                      ↳ Platform facilitation fee (15% included)
                    </td>
                    <td className="px-4 py-2 text-right text-ink-soft text-[11px]">{inr(platformFee)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-ink-soft text-[11px] pl-6">
                      ↳ Direct Helper compensation credited
                    </td>
                    <td className="px-4 py-2 text-right text-ink-soft text-[11px] font-medium text-urgency-normal">{inr(helperPayout)}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-sand/30 border-t border-border">
                  <tr>
                    <th className="px-4 py-3 font-display text-sm font-bold text-ink">Total Paid</th>
                    <th className="px-4 py-3 text-right font-display text-base font-extrabold text-primary">
                      {request.is_paid === false ? "Free Community Aid" : inr(fare)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Escrow Guarantee Notice */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-primary/5 border border-primary/20 px-3.5 py-2.5 text-[11px] text-ink-soft">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>
              Payment was held securely in Hoodi Escrow and settled directly upon confirmed completion.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand transition"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save Invoice
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
