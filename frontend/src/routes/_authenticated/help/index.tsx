import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/help/")({
  beforeLoad: () => {
    throw redirect({ to: "/help/dashboard" });
  },
});