import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { categories } from "@/backend/db/schema";
import { categoryInput } from "@/backend/domain/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const [category] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1);
  return category ? NextResponse.json({ category }) : errorResponse("Category not found", 404);
}

export async function PATCH(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401);
  const parsed = categoryInput.partial().safeParse(await request.json().catch(() => null)); if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse("Invalid category update", 400);
  const updated = await db.update(categories).set(parsed.data).where(and(eq(categories.id, id), eq(categories.userId, userId))).returning();
  if (!updated.length) return errorResponse("Category not found", 404);
  return NextResponse.json({ category: updated[0] });
}

export async function DELETE(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401);
  try {
    const deleted = await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).returning({ id: categories.id });
    return deleted.length ? NextResponse.json({ success: true }) : errorResponse("Category not found", 404);
  } catch (error) {
    if (error instanceof Error && /foreign key|constraint/i.test(error.message)) return errorResponse("This category is used by a budget. Move or delete that budget before deleting the category.", 409);
    throw error;
  }
}
