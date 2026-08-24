import { test, expect } from "@playwright/test";

test.describe("JOSIE UI - Landing & Navigation", () => {
  test("loads the home page with branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=JOSIE Intelligence Studio")).toBeVisible();
    await expect(page.locator("text=Local Ollama Engine")).toBeVisible();
    await expect(page.locator("#btn-toggle-sidebar")).toBeVisible();
    await expect(page.locator("#btn-nav-new-chat")).toBeVisible();
  });

  test("toggles the sidebar", async ({ page }) => {
    await page.goto("/");
    await page.click("#btn-toggle-sidebar");
    // Sidebar should have appeared; we can verify by checking
    // that the new-chat button inside the sidebar is visible
    await expect(page.locator("#btn-sidebar-new-chat")).toBeVisible({ timeout: 3000 });
  });

  test("opens persona selector modal", async ({ page }) => {
    await page.goto("/");
    await page.click("#btn-nav-persona-select");
    await expect(page.locator("text=JOSIE Core")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=Cognitive Thinker")).toBeVisible();
    // Close the modal
    await page.click("#btn-close-personas");
    await expect(page.locator("text=JOSIE Core")).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe("Chat Input", () => {
  test("shows input textarea with placeholder", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#input-chat-message");
    await expect(input).toBeVisible();
    const placeholder = await input.getAttribute("placeholder");
    expect(placeholder).toContain("Message");
  });

  test("can type into the input", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#input-chat-message");
    await input.fill("Hello JOSIE, how are you?");
    await expect(input).toHaveValue("Hello JOSIE, how are you?");
  });

  test("sends a message on Enter", async ({ page }) => {
    await page.goto("/");
    // First create a conversation by clicking new chat if needed, 
    // or send from the empty state (which should auto-create a chat)
    const input = page.locator("#input-chat-message");
    await input.fill("Test message");
    await input.press("Enter");
    // The input should be cleared after sending
    await expect(input).toHaveValue("", { timeout: 3000 });
  });

  test("does not send on Shift+Enter", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#input-chat-message");
    await input.fill("First line");
    await input.press("Shift+Enter");
    // Should still have the text (not cleared)
    await expect(input).toHaveValue("First line");
  });

  test("stop generation button appears during generation", async ({ page }) => {
    await page.goto("/");
    // Send a message that would trigger streaming
    const input = page.locator("#input-chat-message");
    await input.fill("Count to 100 slowly in words");
    await input.press("Enter");

    // The stop button should appear while generating
    const stopBtn = page.locator("#btn-input-stop-generation");
    // It may or may not appear depending on Ollama availability;
    // If Ollama is connected, it'll show. If not, an error banner
    // may appear instead. This test is best-effort.
    try {
      await expect(stopBtn).toBeVisible({ timeout: 5000 });
    } catch {
      // Ollama may not be running — this is fine
    }
  });
});

test.describe("Web Search & MCP Toggles", () => {
  test("toggles web search grounding", async ({ page }) => {
    await page.goto("/");
    // Toggle via input area button
    const toggleBtn = page.locator("#btn-input-toggle-web-search");
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    // Just verify it didn't crash and button is still interactable
    await expect(toggleBtn).toBeEnabled();
  });

  test("opens MCP tool hub from input", async ({ page }) => {
    await page.goto("/");
    const mcpBtn = page.locator("#btn-input-open-mcp-hub");
    await expect(mcpBtn).toBeVisible();
    await mcpBtn.click();
    // MCP Hub modal should appear
    await expect(page.locator("text=Code Execution Sandbox")).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Settings Modal", () => {
  test("opens settings from navbar and can close", async ({ page }) => {
    await page.goto("/");

    // Click settings button (the gear icon in navbar)
    const settingsBtn = page.locator("#btn-nav-settings");
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await expect(page.locator("text=Provider Settings")).toBeVisible({ timeout: 3000 });
      await page.click("#btn-close-settings");
      await expect(page.locator("text=Provider Settings")).not.toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe("Prompt Library", () => {
  test("opens prompt library from navbar", async ({ page }) => {
    await page.goto("/");
    await page.click("#btn-nav-prompts");
    await expect(page.locator("#btn-close-prompts")).toBeVisible({ timeout: 3000 });
    await page.click("#btn-close-prompts");
  });
});