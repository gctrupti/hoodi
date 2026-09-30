import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bkbzqrtngwbqjzpclyzj.supabase.co";
const SUPABASE_KEY = "sb_publishable_6hzdD1FJ6nkV5Q6QH7At1Q_oU8ygsDl";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAccounts() {
  console.log("Checking requester signin...");
  const { data: req, error: reqErr } = await supabase.auth.signInWithPassword({
    email: "requester@hoodi.com",
    password: "requester123",
  });
  if (reqErr) {
    console.log("Requester signin failed:", reqErr.message);
  } else {
    console.log("Requester OK:", req.user.id, req.user.email);
  }

  console.log("Checking helper signin...");
  const { data: help, error: helpErr } = await supabase.auth.signInWithPassword({
    email: "helper@hoodi.com",
    password: "helper123",
  });
  if (helpErr) {
    console.log("Helper signin failed:", helpErr.message);
  } else {
    console.log("Helper OK:", help.user.id, help.user.email);
  }
}

testAccounts();
