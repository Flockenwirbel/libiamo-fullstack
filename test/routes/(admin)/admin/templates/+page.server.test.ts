import type { ActionFailure } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions, load } from "../../../../../src/routes/(admin)/admin/templates/+page.server";

const { mockOrderBy, mockWhere, mockFrom, mockSelect, mockUpdateWhere, mockUpdateSet, mockUpdate } = vi.hoisted(() => {
	const mockOrderBy = vi.fn();
	const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
	const mockFrom = vi.fn(() => ({ where: mockWhere }));
	const mockSelect = vi.fn(() => ({ from: mockFrom }));

	const mockUpdateWhere = vi.fn();
	const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
	const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

	return { mockOrderBy, mockWhere, mockFrom, mockSelect, mockUpdateWhere, mockUpdateSet, mockUpdate };
});

vi.mock("$lib/server/db", () => ({
	db: {
		select: mockSelect,
		update: mockUpdate,
	},
}));

describe("Admin templates list +page.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("loads templates with empty filters by default", async () => {
		const templates = [{ id: 1, titleBase: "Template A" }];
		mockOrderBy.mockResolvedValueOnce(templates);

		const result = (await load({
			url: new URL("https://example.com/admin/templates"),
		} as any)) as any;

		expect(result.templates).toEqual(templates);
		expect(result.filters).toEqual({ language: null, type: null, active: null });
	});

	it("loads templates with provided filters", async () => {
		mockOrderBy.mockResolvedValueOnce([{ id: 2 }]);

		const result = (await load({
			url: new URL("https://example.com/admin/templates?language=en&type=chat&active=true"),
		} as any)) as any;

		expect(mockWhere).toHaveBeenCalled();
		expect(result.filters).toEqual({ language: "en", type: "chat", active: "true" });
	});

	it("supports active=false filter", async () => {
		mockOrderBy.mockResolvedValueOnce([{ id: 3 }]);

		const result = (await load({
			url: new URL("https://example.com/admin/templates?active=false"),
		} as any)) as any;

		expect(result.filters).toEqual({ language: null, type: null, active: "false" });
	});

	it("toggleActive returns 400 for invalid id", async () => {
		const formData = new FormData();
		formData.append("id", "not-a-number");
		formData.append("isActive", "true");

		const result = (await actions.toggleActive({
			request: { formData: async () => formData },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.message).toBe("Invalid template id");
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it("toggleActive flips active state", async () => {
		const formData = new FormData();
		formData.append("id", "7");
		formData.append("isActive", "false");

		const result = await actions.toggleActive({
			request: { formData: async () => formData },
		} as any);

		expect(mockUpdate).toHaveBeenCalled();
		expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: true });
		expect(mockUpdateWhere).toHaveBeenCalled();
		expect(result).toEqual({ toggled: true });
	});
});
