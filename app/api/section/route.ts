import { NextResponse } from "next/server";
import {
  createSection,
  getSection,
  getAllSections,
  updateSection,
  deleteSection,
} from "@/actions/section";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const policyId = searchParams.get("policyId");

    if (id) {
      const section = await getSection(id);
      return NextResponse.json(section);
    }

    const sections = await getAllSections(policyId ?? undefined);
    return NextResponse.json(sections);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const section = await createSection(data);
    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Бүлгийн ID шаардлагатай" },
        { status: 400 }
      );
    }
    const data = await request.json();
    const updatedSection = await updateSection(id, data);
    return NextResponse.json(updatedSection);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Бүлгийн ID шаардлагатай" },
        { status: 400 }
      );
    }
    const deletedSection = await deleteSection(id);
    return NextResponse.json(deletedSection);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
