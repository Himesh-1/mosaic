import { test, expect } from "@playwright/test";

test.describe("Mosaic End-to-End Space Experience", () => {
  const testEmail = `user-${Date.now()}@example.com`;
  const spaceTitle = `Mountain Hike ${Date.now()}`;

  test("should register, create a space, and navigate the space shell", async ({
    page,
  }) => {
    // 1. Visit homepage
    await page.goto("/");
    await expect(page).toHaveTitle(/Mosaic/i);

    // 2. Open Auth modal and Register
    const signInBtn = page.getByRole("button", { name: /sign in/i });
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      const switchToRegister = page.getByRole("button", {
        name: /create an account/i,
      });
      if (await switchToRegister.isVisible()) {
        await switchToRegister.click();
      }

      await page.getByPlaceholder(/your name/i).fill("Alice Host");
      await page.getByPlaceholder(/you@example\.com/i).fill(testEmail);
      await page.getByPlaceholder(/••••••••/i).fill("Password1234!");
      await page.getByRole("button", { name: /create account/i }).click();

      // Verify header shows user name
      await expect(page.getByText("Alice Host")).toBeVisible({ timeout: 5000 });
    }

    // 3. Create a new Space
    await page
      .getByRole("button", { name: /create space/i })
      .first()
      .click();
    await page.getByPlaceholder(/e\.g\. trip to tokyo/i).fill(spaceTitle);
    await page
      .getByRole("button", { name: /create space/i })
      .last()
      .click();

    // 4. Verify redirected to Space detail view
    await expect(page.getByRole("heading", { name: spaceTitle })).toBeVisible({
      timeout: 6000,
    });

    // 5. Navigate Tabs (Chat, Gallery, Organize, People)
    await page.getByRole("button", { name: /chat/i }).click();
    await expect(
      page.getByPlaceholder(new RegExp(`Message ${spaceTitle}`, "i")),
    ).toBeVisible();

    await page.getByRole("button", { name: /gallery/i }).click();
    await expect(page.getByText(/media & files/i)).toBeVisible();

    await page.getByRole("button", { name: /organize/i }).click();
    await expect(page.getByText(/decisions & tasks/i)).toBeVisible();

    await page.getByRole("button", { name: /people/i }).click();
    await expect(page.getByText("Alice Host")).toBeVisible();
  });
});
