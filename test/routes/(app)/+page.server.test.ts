import type { ActionFailure } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/server/auth";
import { actions, load } from "../../../src/routes/(app)/+page.server";

const { mockWhere, mockInnerJoin, mockFrom, mockSelect, mockOnConflictDoNothing, mockValues, mockInsert } = vi.hoisted(() => {
	const mockWhere = vi.fn();
	const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
	const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin }));
	const mockSelect = vi.fn(() => ({ from: mockFrom }));
	const mockOnConflictDoNothing = vi.fn();
	const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
	const mockInsert = vi.fn(() => ({ values: mockValues }));
	return { mockWhere, mockInnerJoin, mockFrom, mockSelect, mockOnConflictDoNothing, mockValues, mockInsert };
});

const { mockEnsureTasksForDate, mockGetMondayOfWeek, mockToDateString } = vi.hoisted(() => ({
	mockEnsureTasksForDate: vi.fn(),
	mockGetMondayOfWeek: vi.fn(() => new Date("2026-04-06T00:00:00.000Z")),
	mockToDateString: vi.fn((d: Date) => d.toISOString().slice(0, 10)),
}));

vi.mock("$lib/server/auth", () => ({
	auth: {
		api: {
			updateUser: vi.fn(),
		},
	},
}));

vi.mock("$lib/server/db", () => ({
	db: {
		select: mockSelect,
		insert: mockInsert,
	},
}));

vi.mock("$lib/server/db/schema", () => ({
	task: {
		id: "id",
		titleResolved: "titleResolved",
		descriptionResolved: "descriptionResolved",
		objectivesResolved: "objectivesResolved",
		date: "date",
		language: "language",
		templateId: "templateId",
	},
	template: {
		id: "id",
		type: "type",
		ui: "ui",
		difficulty: "difficulty",
		duration: "duration",
	},
	userLearningProfile: Symbol("userLearningProfile"),
}));

vi.mock("$lib/server/tasks", () => ({
	ensureTasksForDate: mockEnsureTasksForDate,
	getMondayOfWeek: mockGetMondayOfWeek,
	toDateString: mockToDateString,
}));

describe("(app) home +page.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("redirects unauthenticated users", async () => {
		try {
			await load({ locals: { user: null } } as any);
			expect.fail("Should have thrown a redirect");
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe("/sign-in");
		}
	});

	it("loads weekly and daily tasks for active language", async () => {
		const weeklyTasks = [{ id: 1, titleResolved: "Weekly" }];
		const dailyTasks = [{ id: 2, titleResolved: "Daily" }];
		mockWhere.mockResolvedValueOnce(weeklyTasks).mockResolvedValueOnce(dailyTasks);

		const user = { id: "u1", activeLanguage: "en" };
		const result = await load({ locals: { user } } as any);

		expect(mockEnsureTasksForDate).toHaveBeenCalledTimes(1);
		expect(mockEnsureTasksForDate).toHaveBeenCalledWith("en", expect.any(Date));
		expect(result).toEqual({
			weeklyTasks,
			dailyTasks,
			language: "en",
		});
	});

	describe("switchLanguage action", () => {
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

		it("returns 400 for invalid language", async () => {
			const result = (await actions.switchLanguage(createEvent({ language: "de" }))) as ActionFailure<any>;

			expect(result.status).toBe(400);
			expect(result.data?.message).toBe("Invalid language");
			expect(auth.api.updateUser).not.toHaveBeenCalled();
		});

		it("returns 400 when language field is missing", async () => {
			const result = (await actions.switchLanguage(createEvent({}))) as ActionFailure<any>;

			expect(result.status).toBe(400);
			expect(result.data?.message).toBe("Invalid language");
		});

		it("returns 401 when user id is missing", async () => {
			const result = (await actions.switchLanguage(createEvent({ language: "fr" }, ""))) as ActionFailure<any>;
			expect(result.status).toBe(401);
		});

		it("updates language, ensures profile, and redirects", async () => {
			const event = createEvent({ language: "ja" }, "user-1");

			try {
				await actions.switchLanguage(event);
				expect.fail("Should have thrown a redirect");
			} catch (error: any) {
				expect(error.status).toBe(302);
				expect(error.location).toBe("/");
			}

			expect(auth.api.updateUser).toHaveBeenCalledWith({
				body: { activeLanguage: "ja" },
				headers: event.request.headers,
			});
			expect(mockInsert).toHaveBeenCalled();
			expect(mockValues).toHaveBeenCalledWith({ userId: "user-1", language: "ja" });
			expect(mockOnConflictDoNothing).toHaveBeenCalled();
		});
	});
});
