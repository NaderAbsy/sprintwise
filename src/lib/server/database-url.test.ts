import { describe, expect, it } from "vitest";
import { withVerifiedSsl } from "@/lib/server/database-url";

describe("withVerifiedSsl", () => {
  it("asks for verify-full instead of the modes pg will weaken", () => {
    expect(withVerifiedSsl("postgresql://u:p@host/db?sslmode=require&channel_binding=require")).toBe(
      "postgresql://u:p@host/db?sslmode=verify-full&channel_binding=require",
    );
    expect(withVerifiedSsl("postgresql://u:p@host/db?x=1&sslmode=prefer")).toBe("postgresql://u:p@host/db?x=1&sslmode=verify-full");
    expect(withVerifiedSsl("postgresql://u:p@host/db?sslmode=verify-ca")).toBe("postgresql://u:p@host/db?sslmode=verify-full");
  });

  it("leaves other settings alone", () => {
    for (const url of ["postgresql://u:p@localhost:5432/db", "postgresql://u:p@host/db?sslmode=disable", "postgresql://u:p@host/db?sslmode=verify-full"]) {
      expect(withVerifiedSsl(url)).toBe(url);
    }
    expect(withVerifiedSsl(undefined)).toBeUndefined();
  });
});
