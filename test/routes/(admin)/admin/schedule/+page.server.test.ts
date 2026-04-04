import type { ActionFailure } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions, load } from "../../../../../src/routes/(admin)/admin/schedule/+page.server";

const { mockOrderBy, mockWhere, mockInnerJoin, mockFrom, mockSelect } = vi.hoisted(() => {
	const mockOrderBy = vi.fn();
	const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
	const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
	const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin, where: mockWhere }));
	const mockSelect = vi.fn(() => ({ from: mockFrom }));
	return { mockOrderBy, mockWhere, mockInnerJoin, mockFrom, mockSelect };
});

const { mockScheduleTaskManually } = vi.hoisted(() => ({
	mockScheduleTaskManually: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
	db: {
		select: mockSelect,
	},
}));

vi.mock("$lib/server/tasks", () => ({
	scheduleTaskManually: mockScheduleTaskManually,
}));

describe("Admin schedule +page.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("load uses defaults when query params are missing", async () => {
		mockOrderBy.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 10 }]);

		const result = (await load({ url: new URL("https://example.com/admin/schedule") } as any)) as any;

		expect(result.scheduledTasks).toEqual([{ id: 1 }]);
		expect(result.activeTemplates).toEqual([{ id: 10 }]);
		expect(result.filters.language).toBe("en");
		expect(result.filters.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("load respects provided filters", async () => {
		mockOrderBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		const result = (await load({
			url: new URL("https://example.com/admin/schedule?date=2026-04-04&language=fr"),
		} as any)) as any;

		expect(result.filters).toEqual({ date: "2026-04-04", language: "fr" });
	});

	it("schedule action returns 400 for invalid payload", async () => {
		const formData = new FormData();
		formData.append("templateId", "bad");
		formData.append("date", "2026-4-4");

		const result = (await actions.schedule({
			request: { formData: async () => formData },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.errors).toBeDefined();
		expect(mockScheduleTaskManually).not.toHaveBeenCalled();
	});

	it("schedule action returns 400 when fields are missing", async () => {
		const result = (await actions.schedule({
			request: { formData: async () => new FormData() },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.values).toEqual({ templateId: "", date: "" });
	});

	it("schedule action returns 400 when scheduler throws", async () => {
		mockScheduleTaskManually.mockRejectedValueOnce(new Error("Template not found"));
		const formData = new FormData();
		formData.append("templateId", "1");
		formData.append("date", "2026-04-04");

		const result = (await actions.schedule({
			request: { formData: async () => formData },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.message).toBe("Template not found");
	});

	it("schedule action returns generic message for non-Error throw", async () => {
		mockScheduleTaskManually.mockRejectedValueOnce("boom");
		const formData = new FormData();
		formData.append("templateId", "1");
		formData.append("date", "2026-04-04");

		const result = (await actions.schedule({
			request: { formData: async () => formData },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.message).toBe("Failed to schedule task");
	});

	it("schedule action returns success on valid input", async () => {
		const formData = new FormData();
		formData.append("templateId", "2");
		formData.append("date", "2026-04-04");

		const result = await actions.schedule({
			request: { formData: async () => formData },
		} as any);

		expect(mockScheduleTaskManually).toHaveBeenCalledWith(2, "2026-04-04");
		expect(result).toEqual({ success: true });
	});
});
