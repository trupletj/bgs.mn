import { NextResponse } from "next/server";
import { savePolicyDocument } from "@/actions/policy-document";

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Журмын ID шаардлагатай" },
        { status: 400 },
      );
    }

    const data = await request.json();
    const savedPolicy = await savePolicyDocument(id, data);

    return NextResponse.json(savedPolicy);
  } catch (error) {
    console.error("Policy document save error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
