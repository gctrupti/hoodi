import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editHelpRequest } from "@/lib/hoodi/requests.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

interface EditRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    urgency: string;
    estimated_fare?: number | null;
    address_text?: string | null;
    pickup_name?: string | null;
    pickup_address?: string | null;
    dropoff_name?: string | null;
    dropoff_address?: string | null;
  };
}

export function EditRequestModal({ open, onOpenChange, request }: EditRequestModalProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(request.title);
  const [description, setDescription] = useState(request.description ?? "");
  const [category, setCategory] = useState(request.category);
  const [urgency, setUrgency] = useState(request.urgency);
  const [fare, setFare] = useState(request.estimated_fare?.toString() ?? "50");
  const [pickupName, setPickupName] = useState(request.pickup_name ?? "");
  const [pickupAddress, setPickupAddress] = useState(request.pickup_address ?? "");
  const [dropoffName, setDropoffName] = useState(request.dropoff_name ?? "");
  const [dropoffAddress, setDropoffAddress] = useState(request.dropoff_address ?? request.address_text ?? "");

  const editMutation = useMutation({
    mutationFn: () =>
      editHelpRequest({
        data: {
          requestId: request.id,
          title: title.trim(),
          description: description.trim(),
          category: category as any,
          urgency: urgency as any,
          estimated_fare: fare ? Number(fare) : null,
          pickup_name: pickupName.trim() || null,
          pickup_address: pickupAddress.trim() || null,
          dropoff_name: dropoffName.trim() || null,
          dropoff_address: dropoffAddress.trim() || null,
          address_text: dropoffAddress.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Request updated successfully.");
      qc.invalidateQueries({ queryKey: ["request", request.id] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card sm:rounded-3xl border border-border shadow-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold text-ink">Edit Errand Request</DialogTitle>
              <DialogDescription className="text-xs text-ink-soft">
                Update task details before a neighbor accepts it.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            editMutation.mutate();
          }}
          className="space-y-4 mt-3"
        >
          <div>
            <label className="text-xs font-semibold text-ink-soft">Task Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Medicine pickup from Apollo Indiranagar"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-soft">Description & Instructions</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details on what to buy, instructions for gatekeeper, etc."
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-soft">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="grocery">Grocery</option>
                <option value="first_aid">First Aid & Medical</option>
                <option value="transportation">Transportation</option>
                <option value="elderly_care">Elderly Care</option>
                <option value="errand">Errand</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft">Urgency</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="normal">Normal</option>
                <option value="today">Today</option>
                <option value="emergency">Emergency (Free Mutual Aid)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-soft">Offered Fare (₹)</label>
              <input
                type="number"
                min={0}
                value={fare}
                disabled={urgency === "emergency"}
                onChange={(e) => setFare(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft">Pickup Shop/Name</label>
              <input
                value={pickupName}
                onChange={(e) => setPickupName(e.target.value)}
                placeholder="e.g. Apollo Pharmacy"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-soft">Pickup Address</label>
            <input
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="e.g. 100ft Rd, Indiranagar"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-soft">Dropoff / Delivery Address</label>
            <input
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              placeholder="e.g. 12th Main, Indiranagar"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
            >
              {editMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
