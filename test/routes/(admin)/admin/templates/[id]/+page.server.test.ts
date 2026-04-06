import type { ActionFailure } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions, load } from "../../../../../../src/routes/(admin)/admin/templates/[id]/+page.server";

const { mockLimit, mockWhere, mockFrom, mockSelect, mockUpdateWhere, mockUpdateSet, mockUpdate } = vi.hoisted(() => {
	const mockLimit = vi.fn();
	const mockWhere = vi.fn(() => ({ limit: mockLimit }));
	const mockFrom = vi.fn(() => ({ where: mockWhere }));
	const mockSelect = vi.fn(() => ({ from: mockFrom }));

	const mockUpdateWhere = vi.fn();
	const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
	const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

	return { mockLimit, mockWhere, mockFrom, mockSelect, mockUpdateWhere, mockUpdateSet, mockUpdate };
});

vi.mock("$lib/server/db", () => ({
	db: {
		select: mockSelect,
		update: mockUpdate,
	},
}));

function createValidTemplateFormData() {
	const formData = new FormData();
	formData.append("language", "en");
	formData.append("type", "chat");
	formData.append("ui", "discord");
	formData.append("duration", "weekly");
	formData.append("difficulty", "2");
	formData.append("pointReward", "10");
	formData.append("gemReward", "3");
	formData.append("titleBase", "Hello {{name}}");
	formData.append("descriptionBase", "desc");
	formData.append("agentPromptBase", "prompt");
	formData.append("backgroundHtml", "<p>bg</p>");
	formData.append("objectivesBase", JSON.stringify([{ order: 1, text: "Do {{thing}}" }]));
	formData.append("agentPersonaPool", JSON.stringify([{ name: "Alex" }]));
	formData.append("candidates", JSON.stringify([{ slots: { name: "Learner", thing: "task" } }]));
	return formData;
}

describe("Admin template detail +page.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("load returns 404 when id is invalid", async () => {
		try {
			await load({ params: { id: "abc" } } as any);
			expect.fail("Should have thrown error");
		} catch (error: any) {
			expect(error.status).toBe(404);
		}
	});

	it("load returns 404 when template does not exist", async () => {
		mockLimit.mockResolvedValueOnce([]);

		try {
			await load({ params: { id: "1" } } as any);
			expect.fail("Should have thrown error");
		} catch (error: any) {
			expect(error.status).toBe(404);
		}
	});

	it("load returns template when found", async () => {
		const tpl = { id: 1, titleBase: "T" };
		mockLimit.mockResolvedValueOnce([tpl]);

		const result = (await load({ params: { id: "1" } } as any)) as any;
		expect(result).toEqual({ template: tpl });
	});

	it("save returns 400 for invalid payload", async () => {
		const fd = new FormData();
		fd.append("language", "en");

		const result = (await actions.save({
			params: { id: "1" },
			request: { formData: async () => fd },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it("save updates template and returns saved flag", async () => {
		const result = await actions.save({
			params: { id: "12" },
			request: { formData: async () => createValidTemplateFormData() },
		} as any);

		expect(mockUpdate).toHaveBeenCalled();
		expect(mockUpdateSet).toHaveBeenCalled();
		expect(mockUpdateWhere).toHaveBeenCalled();
		expect(result).toEqual({ saved: true });
	});

	it("delete soft-deletes template and redirects", async () => {
		try {
			await actions.delete({ params: { id: "5" } } as any);
			expect.fail("Should have thrown redirect");
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe("/admin/templates");
		}

		expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: false });
		expect(mockUpdateWhere).toHaveBeenCalled();
	});
});
