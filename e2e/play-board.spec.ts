import { expect, test } from "@playwright/test";

test.describe("Play board", () => {
  test("hides the Play board location badge outside pending move confirmation", async ({ page }) => {
    await page.goto("/?page=match");

    const board = page.getByRole("grid", { name: "Chess board" });
    await expect(board).toBeVisible();

    const boardPanel = page.locator(".board-panel").filter({ has: board });
    await expect(boardPanel).toBeVisible();
    await expect(boardPanel.locator(".district-badge--header")).toHaveCount(0);
    await expect(boardPanel.locator(".board-panel__multiplayer-notice")).toHaveCount(0);
    await expect(boardPanel.getByRole("button", { name: "Clear" })).toHaveCount(0);
    await expect(boardPanel.getByRole("button", { name: "Confirm" })).toHaveCount(0);
  });
});
