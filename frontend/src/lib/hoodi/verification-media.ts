import { supabase } from "@/integrations/supabase/client";

const BUCKET = "verification-docs";

/** Uploads an ID document into the caller's private folder and returns its path. */
export async function uploadVerificationDoc(file: File) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You need to be signed in to upload.");
  if (!/^image\/|^application\/pdf$/.test(file.type)) {
    throw new Error("Upload an image or PDF of your ID.");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Files must be under 8 MB.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/government-id-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}