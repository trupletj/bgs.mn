import { NextResponse } from "next/server";
import { hasPermission } from "@/actions/rbac";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const canAccess = await hasPermission("policy", "access");
    if (!canAccess) {
      return NextResponse.json({ error: "Хавсралт үзэх эрхгүй байна" }, { status: 403 });
    }

    const { id, attachmentId } = await params;
    const supabase = await createClient();
    const { data: attachment, error } = await supabase
      .from("legal_act_attachments")
      .select("bucket, storage_path")
      .eq("id", attachmentId)
      .eq("legal_act_id", id)
      .single();

    if (error || !attachment) {
      return NextResponse.json({ error: "Хавсралт олдсонгүй" }, { status: 404 });
    }

    const { data, error: signedError } = await supabase.storage
      .from(attachment.bucket)
      .createSignedUrl(attachment.storage_path, 300);

    if (signedError || !data?.signedUrl) {
      throw new Error(signedError?.message || "Signed URL үүссэнгүй");
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
