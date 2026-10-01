"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";

/** Deletes the user; the schema cascades to sessions, accounts, projects and AI usage (story F-5). */
export async function deleteAccount() {
  const user = await requireUser();
  await db.user.delete({ where: { id: user.id } });
  redirect("/");
}
