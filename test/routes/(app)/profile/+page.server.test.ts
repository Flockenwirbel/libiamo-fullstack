import type { ActionFailure } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/server/auth";
import { actions } from "../../../../src/routes/(app)/profile/+page.server";

const { mockOnConflictDoNothing, mockValues, mockInsert } = vi.hoisted(() => {
	const mockOnConflictDoNothing = vi.fn();
	const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
	const mockInsert = vi.fn(() => ({ values: mockValues }));
	return { mockOnConflictDoNothing, mockValues, mockInsert };
});

vi.mock("$lib/server/auth", () => ({
	auth: {
		api: {
			updateUser: vi.fn(),
			signOut: vi.fn(),
		},
	},
}));

vi.mock("$lib/server/db", () => ({
	db: {
		insert: mockInsert,
	},
}));

vi.mock("$lib/server/db/schema", () => ({
	userLearningProfile: Symbol("userLearningProfile"),
}));

describe("Profile +page.server actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createEvent = (entries: Record<string, string>, userId = "u1") => {
		const formData = new FormData();
		for (const [key, value] of Object.entries(entries)) {
			formData.append(key, value);
		}

		return {
			locals: { user: userId ? { id: userId } : null },
			request: {
				formData: async () => formData,
				headers: new Headers(),
			},
		} as any;
	};

	it("updateProfile returns 400 for invalid payload", async () => {
		const result = (await actions.updateProfile(
			createEvent({
				name: "x".repeat(60),
			}),
		)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.errors?.name).toBeDefined();
		expect(auth.api.updateUser).not.toHaveBeenCalled();
	});

	it("updateProfile handles missing optional fields", async () => {
		const event = createEvent({});

		const result = await actions.updateProfile(event);

		expect(auth.api.updateUser).toHaveBeenCalledWith({
			body: {},
			headers: event.request.headers,
		});
		expect(result).toEqual({ success: true });
	});

	it("updateProfile calls auth update and returns success", async () => {
		const event = createEvent({
			name: "Alice",
			timezone: "Asia/Shanghai",
			nativeLanguage: "zh",
		});

		const result = await actions.updateProfile(event);

		expect(auth.api.updateUser).toHaveBeenCalledWith({
			body: {
				name: "Alice",
				timezone: "Asia/Shanghai",
				nativeLanguage: "zh",
			},
			headers: event.request.headers,
		});
		expect(result).toEqual({ success: true });
	});

	it("switchLanguage returns 400 for invalid language", async () => {
		const result = (await actions.switchLanguage(
			createEvent({
				language: "de",
			}),
		)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.message).toBe("Invalid language");
		expect(auth.api.updateUser).not.toHaveBeenCalled();
	});

	it("switchLanguage returns 400 when language field is missing", async () => {
		const result = (await actions.switchLanguage(createEvent({}))) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.message).toBe("Invalid language");
	});

	it("switchLanguage returns 401 when user missing", async () => {
		const event = createEvent({ language: "en" }, "");
		const result = (await actions.switchLanguage(event)) as ActionFailure<any>;
		expect(result.status).toBe(401);
	});

	it("switchLanguage updates language, ensures profile, and redirects", async () => {
		const event = createEvent({ language: "fr" }, "user-1");

		try {
			await actions.switchLanguage(event);
			expect.fail("Should have thrown a redirect");
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe("/");
		}

		expect(auth.api.updateUser).toHaveBeenCalledWith({
			body: { activeLanguage: "fr" },
			headers: event.request.headers,
		});
		expect(mockInsert).toHaveBeenCalled();
		expect(mockValues).toHaveBeenCalledWith({
			userId: "user-1",
			language: "fr",
		});
		expect(mockOnConflictDoNothing).toHaveBeenCalled();
	});

	it("signOut calls auth api and redirects", async () => {
		const event = createEvent({});

		try {
			await actions.signOut(event);
			expect.fail("Should have thrown a redirect");
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe("/sign-in");
		}

		expect(auth.api.signOut).toHaveBeenCalledWith({ headers: event.request.headers });
	});
});
