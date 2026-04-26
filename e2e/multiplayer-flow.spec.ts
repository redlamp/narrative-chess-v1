import { expect, test, type Page } from "@playwright/test";

type TestAccount = {
  email: string;
  password: string;
  username: string;
};

const playerA: TestAccount = {
  email: process.env.E2E_PLAYER_A_EMAIL ?? "",
  password: process.env.E2E_PLAYER_A_PASSWORD ?? "",
  username: process.env.E2E_PLAYER_A_USERNAME ?? ""
};

const playerB: TestAccount = {
  email: process.env.E2E_PLAYER_B_EMAIL ?? "",
  password: process.env.E2E_PLAYER_B_PASSWORD ?? "",
  username: process.env.E2E_PLAYER_B_USERNAME ?? ""
};

const missingCredentials = [
  "E2E_PLAYER_A_EMAIL",
  "E2E_PLAYER_A_PASSWORD",
  "E2E_PLAYER_A_USERNAME",
  "E2E_PLAYER_B_EMAIL",
  "E2E_PLAYER_B_PASSWORD",
  "E2E_PLAYER_B_USERNAME"
].filter((name) => !process.env[name]);

async function signIn(page: Page, account: TestAccount) {
  await page.goto("/?page=match");
  await page.getByRole("button", { name: "Open sign in" }).click();

  const accountPanel = page.getByRole("dialog", { name: "Account Details" });
  await accountPanel.getByLabel("Email").fill(account.email);
  await accountPanel.getByLabel("Password").fill(account.password);
  await accountPanel.getByRole("button", { name: /^Sign in$/ }).click();

  await expect(page.getByRole("button", { name: "Open account details" })).toBeVisible();
  await page.getByRole("button", { name: "Close account panel" }).click();
}

async function chooseSelectOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

async function createWhiteInvite(page: Page, opponentUsername: string) {
  await expect(page.getByRole("heading", { name: "Open Games" })).toBeVisible();
  await page.getByRole("button", { name: "Make Game" }).click();

  const dialog = page.getByRole("dialog", { name: "Make Game" });
  await dialog.getByLabel("Opponent name").fill(opponentUsername);
  await chooseSelectOption(page, "Creator side", "White");
  await dialog.getByRole("button", { name: "Send Invite" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Multiplayer invite sent.")).toBeVisible();
}

async function refreshActiveGames(page: Page) {
  await page.getByRole("button", { name: "Refresh active games" }).click();
}

async function acceptInvite(page: Page) {
  await expect(page.getByRole("heading", { name: "Open Games" })).toBeVisible();
  await refreshActiveGames(page);

  const activeList = page.locator(".recent-games-active__list");
  await expect(activeList.getByRole("button", { name: "Accept" }).first()).toBeVisible();
  await activeList.getByRole("button", { name: "Accept" }).first().click();
  await expect(page.getByText("Invite accepted.")).toBeVisible();
}

async function loadFirstActiveGame(page: Page) {
  await refreshActiveGames(page);

  const activeList = page.locator(".recent-games-active__list");
  const openButton = activeList.getByRole("button", { name: /^(Resume|Open)$/ }).first();
  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(page.getByRole("grid", { name: "Chess board" })).toBeVisible();
}

async function clickSquare(page: Page, square: string) {
  await page.getByRole("button", { name: new RegExp(`^${square}(,|$)`, "i") }).click();
}

async function makeMove(page: Page, from: string, to: string) {
  await clickSquare(page, from);
  await clickSquare(page, to);
}

test.describe("multiplayer move sync", () => {
  test.skip(
    missingCredentials.length > 0,
    `Set ${missingCredentials.join(", ")} to run the hosted multiplayer smoke.`
  );

  test("confirms moves through one client and receives them through the opponent client", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await signIn(pageA, playerA);
    await signIn(pageB, playerB);

    await createWhiteInvite(pageA, playerB.username);
    await acceptInvite(pageB);

    await loadFirstActiveGame(pageA);
    await loadFirstActiveGame(pageB);

    await makeMove(pageA, "e2", "e4");
    await expect(pageA.getByRole("button", { name: "Clear" })).toBeVisible();
    await expect(pageA.getByRole("button", { name: "Confirm" })).toBeVisible();
    await pageA.getByRole("button", { name: "Confirm" }).click();
    await expect(pageA.getByRole("button", { name: "Confirm" })).toHaveCount(0);

    await expect
      .poll(async () => pageB.getByRole("button", { name: /^e4, White pawn/i }).count(), {
        timeout: 20_000
      })
      .toBeGreaterThan(0);

    await makeMove(pageB, "e7", "e5");
    await expect(pageB.getByRole("button", { name: "Confirm" })).toBeVisible();
    await pageB.getByRole("button", { name: "Confirm" }).click();
    await expect(pageB.getByRole("button", { name: "Confirm" })).toHaveCount(0);

    await expect
      .poll(async () => pageA.getByRole("button", { name: /^e5, Black pawn/i }).count(), {
        timeout: 20_000
      })
      .toBeGreaterThan(0);

    await contextA.close();
    await contextB.close();
  });
});
