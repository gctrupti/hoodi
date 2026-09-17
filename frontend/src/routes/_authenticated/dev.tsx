import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyLocation, updateMyProfile, addOfferTag } from "@/lib/hoodi/profiles.functions";
import {
  createHelpRequest,
  listNearbyRequests,
  acceptRequest,
  updateRequestStatus,
  listMyRequests,
} from "@/lib/hoodi/requests.functions";
import { simulateCapturePayment, listMyPayments } from "@/lib/hoodi/payments.functions";
import { getMyWallet } from "@/lib/hoodi/wallet.functions";
import { listMyNotifications } from "@/lib/hoodi/notifications.functions";
import { getThreadForRequest, sendMessage, listMessages } from "@/lib/hoodi/chat.functions";
import { submitRating } from "@/lib/hoodi/ratings.functions";

export const Route = createFileRoute("/_authenticated/dev")({
  head: () => ({
    meta: [
      { title: "Hoodi — Dev Harness" },
      { name: "description", content: "Backend verification harness for the Hoodi marketplace." },
    ],
  }),
  component: DevHarness,
});

type LogEntry = { at: string; label: string; ok: boolean; payload: unknown };

function DevHarness() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [state, setState] = useState<{
    lastRequestId?: string;
    lastThreadId?: string;
    lastHelperId?: string;
    lastRequesterId?: string;
  }>({});
  const [lat, setLat] = useState<number>(19.076);
  const [lng, setLng] = useState<number>(72.8777);
  const [title, setTitle] = useState("Need groceries for elderly parent");
  const [description, setDescription] = useState("2 kg rice, milk, eggs. Nearby store OK.");
  const [radius, setRadius] = useState<number>(5000);
  const [messageText, setMessageText] = useState("Hi, I'm on my way!");
  const [pastedRequestId, setPastedRequestId] = useState<string>("");
  const [seedCreds, setSeedCreds] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const log = useCallback((label: string, ok: boolean, payload: unknown) => {
    setLogs((prev) => [
      { at: new Date().toISOString().slice(11, 19), label, ok, payload },
      ...prev,
    ].slice(0, 60));
  }, []);

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      try {
        const result = await fn();
        log(label, true, result);
        return result;
      } catch (err) {
        log(label, false, err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [log],
  );

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hoodi — Dev Harness</h1>
          <p className="text-sm text-muted-foreground">Signed in as {email || "…"}</p>
        </div>
        <button onClick={signOut} className="text-sm underline">Sign out</button>
      </header>

      <section className="border rounded-lg p-4 space-y-3 bg-amber-50">
        <h2 className="font-semibold">0. Two-user testing shortcuts</h2>
        <Row>
          <button
            className="btn"
            onClick={async () => {
              const rand = Math.random().toString(36).slice(2, 8);
              const creds = { email: `helper_${rand}@hoodi.test`, password: `Passw0rd!${rand}` };
              const res = await run(`seedSecondUser(${creds.email})`, async () => {
                // Sign up the second user in an isolated auth client so we don't
                // clobber the current session in this tab.
                const { createClient } = await import("@supabase/supabase-js");
                const url = import.meta.env.VITE_SUPABASE_URL as string;
                const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
                const tmp = createClient(url, key, {
                  auth: { persistSession: false, autoRefreshToken: false, storageKey: `hoodi-seed-${rand}` },
                });
                const { data, error } = await tmp.auth.signUp({
                  email: creds.email,
                  password: creds.password,
                });
                if (error) throw error;
                return { userId: data.user?.id, email: creds.email };
              });
              if (res) setSeedCreds(creds);
            }}
          >
            Seed second test user
          </button>
          {seedCreds && (
            <div className="text-xs font-mono bg-white border rounded p-2">
              <div><b>email:</b> {seedCreds.email}</div>
              <div><b>pass:</b> {seedCreds.password}</div>
              <button
                className="btn mt-1"
                onClick={() => navigator.clipboard.writeText(`${seedCreds.email} / ${seedCreds.password}`)}
              >
                Copy
              </button>
              <p className="text-muted-foreground mt-1">
                Open an incognito window → /auth → sign in with these creds to act as the helper.
              </p>
            </div>
          )}
        </Row>
        <Row>
          <input
            className="input flex-1"
            placeholder="Paste request id (uuid) to target from this window"
            value={pastedRequestId}
            onChange={(e) => setPastedRequestId(e.target.value.trim())}
          />
          <button
            className="btn"
            disabled={!pastedRequestId}
            onClick={() => {
              setState((s) => ({ ...s, lastRequestId: pastedRequestId }));
              log("useAsLastRequestId", true, { lastRequestId: pastedRequestId });
            }}
          >
            Use as "last request"
          </button>
          <button
            className="btn"
            disabled={!pastedRequestId}
            onClick={async () => {
              const res = await run("acceptRequest(pasted)", () =>
                acceptRequest({ data: { requestId: pastedRequestId } }),
              );
              if (res && typeof res === "object" && "chat_thread_id" in res) {
                setState((s) => ({
                  ...s,
                  lastRequestId: pastedRequestId,
                  lastThreadId: (res as { chat_thread_id: string }).chat_thread_id,
                }));
              }
            }}
          >
            Accept pasted id
          </button>
        </Row>
        <p className="text-xs text-muted-foreground">
          Flow: (A) in this window, create the request → copy its id from the log. (B) seed a second
          user, sign into /auth as them in incognito, paste the id there, and hit "Accept pasted id".
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="1. Profile & location">
          <Row>
            <button className="btn" onClick={() => run("getMyProfile", () => getMyProfile())}>Get my profile</button>
            <button
              className="btn"
              onClick={() =>
                run("updateMyProfile(name=Dev Tester)", () =>
                  updateMyProfile({ data: { name: "Dev Tester", bio: "Testing Hoodi backend" } }),
                )
              }
            >
              Set name
            </button>
          </Row>
          <Row>
            <label className="text-xs">lat<input className="input" type="number" step="0.0001" value={lat} onChange={(e) => setLat(Number(e.target.value))} /></label>
            <label className="text-xs">lng<input className="input" type="number" step="0.0001" value={lng} onChange={(e) => setLng(Number(e.target.value))} /></label>
            <button className="btn" onClick={() => run("updateMyLocation", () => updateMyLocation({ data: { lat, lng } }))}>Set location</button>
          </Row>
          <Row>
            <button className="btn" onClick={() => run("addOfferTag(grocery)", () => addOfferTag({ data: { tag: "grocery" } }))}>Offer "grocery"</button>
            <button className="btn" onClick={() => run("addOfferTag(errand)", () => addOfferTag({ data: { tag: "errand" } }))}>Offer "errand"</button>
          </Row>
        </Panel>

        <Panel title="2. Create help request (AI classifies)">
          <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea className="input w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <Row>
            <button
              className="btn"
              onClick={async () => {
                const res = await run("createHelpRequest", () =>
                  createHelpRequest({ data: { title, description, lat, lng } }),
                );
                if (res && typeof res === "object" && "id" in res) {
                  const r = res as unknown as { id: string; requester_id: string };
                  setState((s) => ({ ...s, lastRequestId: r.id, lastRequesterId: r.requester_id }));
                }
              }}
            >
              Create request
            </button>
            <button
              className="btn"
              onClick={() =>
                run("createHelpRequest(EMERGENCY, free)", () =>
                  createHelpRequest({
                    data: {
                      title: "Bleeding after fall, need first aid NOW",
                      description: "Elderly person tripped, cut on head, bleeding",
                      lat, lng,
                    },
                  }),
                )
              }
            >
              Create emergency (free)
            </button>
          </Row>
        </Panel>

        <Panel title="3. Nearby helpers & accept">
          <Row>
            <label className="text-xs">radius (m)<input className="input" type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} /></label>
            <button className="btn" onClick={() => run("listNearbyRequests", () => listNearbyRequests({ data: { lat, lng, radius_m: radius } }))}>List nearby</button>
            <button className="btn" onClick={() => run("listMyRequests", () => listMyRequests())}>My requests</button>
          </Row>
          <Row>
            <button
              className="btn"
              disabled={!state.lastRequestId}
              onClick={async () => {
                if (!state.lastRequestId) return;
                const res = await run("acceptRequest(lastRequestId)", () =>
                  acceptRequest({ data: { requestId: state.lastRequestId! } }),
                );
                if (res && typeof res === "object" && "chat_thread_id" in res) {
                  setState((s) => ({ ...s, lastThreadId: (res as { chat_thread_id: string }).chat_thread_id }));
                }
              }}
            >
              Accept last request (as helper)
            </button>
          </Row>
          <p className="text-xs text-muted-foreground">
            Tip: to test end-to-end, open this page in a second incognito window as a different user
            and accept from there. Otherwise you'll hit the "helper cannot be requester" guard.
          </p>
        </Panel>

        <Panel title="4. Chat">
          <Row>
            <button
              className="btn"
              disabled={!state.lastRequestId}
              onClick={async () => {
                if (!state.lastRequestId) return;
                const t = await run("getThreadForRequest", () => getThreadForRequest({ data: { requestId: state.lastRequestId! } }));
                if (t && typeof t === "object" && "id" in t) {
                  setState((s) => ({ ...s, lastThreadId: (t as { id: string }).id }));
                }
              }}
            >
              Load thread for last request
            </button>
            <button
              className="btn"
              disabled={!state.lastThreadId}
              onClick={() => run("listMessages", () => listMessages({ data: { threadId: state.lastThreadId! } }))}
            >
              List messages
            </button>
          </Row>
          <Row>
            <input className="input flex-1" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Message text" />
            <button
              className="btn"
              disabled={!state.lastThreadId}
              onClick={() => run("sendMessage", () => sendMessage({ data: { threadId: state.lastThreadId!, content: messageText } }))}
            >
              Send
            </button>
          </Row>
        </Panel>

        <Panel title="5. Status transitions & payment simulation">
          <Row>
            <button className="btn" disabled={!state.lastRequestId} onClick={() => run("→ in_progress", () => updateRequestStatus({ data: { requestId: state.lastRequestId!, newStatus: "in_progress" } }))}>
              Mark in_progress
            </button>
            <button className="btn" disabled={!state.lastRequestId} onClick={() => run("→ completed", () => updateRequestStatus({ data: { requestId: state.lastRequestId!, newStatus: "completed" } }))}>
              Mark completed
            </button>
            <button className="btn" disabled={!state.lastRequestId} onClick={() => run("→ cancelled", () => updateRequestStatus({ data: { requestId: state.lastRequestId!, newStatus: "cancelled" } }))}>
              Cancel
            </button>
          </Row>
          <Row>
            <button
              className="btn"
              disabled={!state.lastRequestId}
              onClick={() => run("simulateCapturePayment (fake webhook)", () => simulateCapturePayment({ data: { requestId: state.lastRequestId! } }))}
            >
              Simulate payment capture
            </button>
            <button className="btn" onClick={() => run("listMyPayments", () => listMyPayments())}>My payments</button>
            <button className="btn" onClick={() => run("getMyWallet", () => getMyWallet())}>My wallet</button>
          </Row>
        </Panel>

        <Panel title="6. Notifications & ratings">
          <Row>
            <button className="btn" onClick={() => run("listMyNotifications", () => listMyNotifications())}>My notifications</button>
            <button
              className="btn"
              disabled={!state.lastRequestId || !state.lastRequesterId}
              onClick={() =>
                run("submitRating(5)", () =>
                  submitRating({
                    data: {
                      requestId: state.lastRequestId!,
                      rateeId: state.lastRequesterId!,
                      score: 5,
                      comment: "Great!",
                    },
                  }),
                )
              }
            >
              Rate requester 5★
            </button>
          </Row>
        </Panel>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Log (newest first)</h2>
        <div className="border rounded divide-y max-h-[500px] overflow-auto">
          {logs.length === 0 && <p className="p-3 text-sm text-muted-foreground">No calls yet.</p>}
          {logs.map((l, i) => (
            <div key={i} className="p-2 text-xs font-mono">
              <div className={l.ok ? "text-emerald-700" : "text-red-700"}>
                [{l.at}] {l.ok ? "OK" : "ERR"} — {l.label}
              </div>
              <pre className="whitespace-pre-wrap break-all text-[11px] mt-1 text-muted-foreground">
                {typeof l.payload === "string" ? l.payload : JSON.stringify(l.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; background: white; }
        .btn:hover:not(:disabled) { background: #f5f5f5; }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; }
      `}</style>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2">{children}</div>;
}