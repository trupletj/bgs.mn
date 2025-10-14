import { NextResponse } from "next/server";
import {
  createClause,
  getClause,
  getAllClauses,
  updateClause,
  deleteClause,
  restoreClause,
} from "@/actions/clause";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const sectionId = searchParams.get("sectionId");

    if (id) {
      const clause = await getClause(id);
      return NextResponse.json(clause);
    }

    const clauses = await getAllClauses(sectionId ?? undefined);
    return NextResponse.json(clauses);
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
    const clause = await createClause(data);
    return NextResponse.json(clause, { status: 201 });
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
        { error: "Заалтын ID шаардлагатай" },
        { status: 400 }
      );
    }
    const data = await request.json();
    const updatedClause = await updateClause(id, data);
    return NextResponse.json(updatedClause);
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
        { error: "Заалтын ID шаардлагатай" },
        { status: 400 }
      );
    }
    const deletedClause = await deleteClause(id);
    return NextResponse.json(deletedClause);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
