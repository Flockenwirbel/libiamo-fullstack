import { describe, expect, it } from "vitest";
import { load } from "../../../src/routes/(admin)/+layout.server";

describe("(admin) layout +layout.server", () => {
	it("redirects to sign-in when user is missing", async () => {
		try {
			await load({ locals: { user: null } } as any);
			expect.fail("Should have thrown a redirect");
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe("/sign-in");
		}
	});

	it("redirects to home when user is not admin", async () => {
		try {
			await load({ locals: { user: { id: "u1", role: "learner" } } } as any);
			expect.fail("Should have thrown a redirect");
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe("/");
		}
	});

	it("returns user when role is admin", async () => {
		const user = { id: "u1", role: "admin" };
		const result = await load({ locals: { user } } as any);
		expect(result).toEqual({ user });
	});
});
