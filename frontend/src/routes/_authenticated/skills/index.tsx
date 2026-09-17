import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/skills/")({
  beforeLoad: () => {
    throw redirect({ to: "/skills/learn" });
  },
});