import type { ActionFailure } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions } from "../../../../../../src/routes/(admin)/admin/templates/new/+page.server";

const { mockValues, mockInsert } = vi.hoisted(() => {
	const mockValues = vi.fn();
	const mockInsert = vi.fn(() => ({ values: mockValues }));
	return { mockValues, mockInsert };
});

vi.mock("$lib/server/db", () => ({
	db: {
		insert: mockInsert,
	},
}));

function createValidTemplateFormData() {
	const formData = new FormData();
	formData.append("language", "en");
	formData.append("type", "chat");
	formData.append("ui", "discord");
	formData.append("duration", "weekly");
	formData.append("difficulty", "2");
	formData.append("maxTurns", "8");
	formData.append("estimatedWords", "120");
	formData.append("pointReward", "10");
	formData.append("gemReward", "3");
	formData.append("isActive", "on");
	formData.append("titleBase", "Hello {{name}}");
	formData.append("descriptionBase", "desc");
	formData.append("agentPromptBase", "prompt");
	formData.append("backgroundHtml", "<p>bg</p>");
	formData.append("objectivesBase", JSON.stringify([{ order: 1, text: "Do {{thing}}" }]));
	formData.append("agentPersonaPool", JSON.stringify([{ name: "Alex", personality: "kind" }]));
	formData.append("candidates", JSON.stringify([{ slots: { name: "Learner", thing: "task" }, context: { a: 1 } }]));
	return formData;
}

describe("Admin template new +page.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 400 for invalid payload", async () => {
		const formData = new FormData();
		formData.append("language", "en");

		const result = (await actions.default({
			locals: { user: { id: "admin-1" } },
			request: { formData: async () => formData },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(400);
		expect(result.data?.errors).toBeDefined();
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("returns 401 when user is missing", async () => {
		const result = (await actions.default({
			locals: { user: null },
			request: { formData: async () => createValidTemplateFormData() },
		} as any)) as ActionFailure<any>;

		expect(result.status).toBe(401);
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("inserts template and redirects on success", async () => {
		try {
			await actions.default({
				locals: { user: { id: "admin-1" } },
				request: { formData: async () => createValidTemplateFormData() },
			} as any);
			expect.fail("Should have thrown a redirect");
		} catch (error: any) {
			expect(error.status).toBe(302);
			expect(error.location).toBe("/admin/templates");
		}

		expect(mockInsert).toHaveBeenCalled();
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				createdBy: "admin-1",
				language: "en",
				type: "chat",
			}),
		);
	});
});
