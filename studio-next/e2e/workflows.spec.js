import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const key = "ledfx-studio-design-prototype-v2";
const project = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test("discover, register, create an RGBW fixture and reject an incompatible patch", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Patch", exact: true }).click();
  await page.getByRole("button", { name: "Discover controllers" }).click();
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByText("3 registered controllers")).toBeVisible();
  await page.getByText("Add fixture", { exact: true }).click();
  await page.getByLabel("Fixture name", { exact: true }).fill("Portable strip");
  await page
    .getByLabel("Fixture profile", { exact: true })
    .selectOption("rgbw");
  await page
    .getByRole("button", { name: "Create fixture", exact: true })
    .click();
  await page.getByRole("button", { name: "Validate & patch" }).click();
  await expect(page.getByRole("alert")).toContainText("Voltage mismatch");
  await page.getByLabel("Controller output").selectOption("c3:p4");
  await page.getByRole("button", { name: "Validate & patch" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await project(page)).connections).toHaveLength(4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await project(page)).connections).toHaveLength(3);
});
test("global palette, local overrides, bulk effects and UV remain independent", async ({
  page,
}) => {
  await page.getByLabel("Palette source").selectOption("ember");
  await page.getByRole("button", { name: "Ocean", exact: true }).click();
  let s = await project(page);
  expect(s.globalPalette).toBe("ocean");
  expect(s.fixtures[0].paletteId).toBe("ember");
  await page.getByRole("button", { name: "Select all fixtures" }).click();
  await page.getByLabel("Effect", { exact: true }).selectOption("Wave");
  s = await project(page);
  expect(s.fixtures.every((f) => f.effect === "Wave")).toBeTruthy();
  await page.getByRole("button", { name: /Centre wash Patched/ }).click();
  await page.getByRole("slider").fill("30");
  await page.getByRole("button", { name: "Aurora", exact: true }).click();
  s = await project(page);
  expect(s.fixtures[2].uv).toBe(30);
  expect(s.fixtures[0].paletteId).toBe("ember");
});
test("stage movement, pixel direction and absence preserve patch and geometry", async ({
  page,
}) => {
  const original = await project(page);
  await page.getByLabel("X position").fill("220");
  await page.getByLabel("Reverse pixel direction").check();
  await page
    .getByRole("button", { name: "Simulate disconnect", exact: true })
    .click();
  let s = await project(page);
  expect(s.geometry[0].x).toBe(220);
  expect(s.connections[0].start).toBe(original.connections[0].start);
  expect(s.connections.find((c) => c.fixtureId === "f1").reversed).toBe(true);
  await page
    .getByRole("button", { name: "Simulate reconnect", exact: true })
    .click();
  await page.reload();
  s = await project(page);
  expect(s.geometry[0].x).toBe(220);
  expect(s.controllers[0].online).toBe(true);
});
test("draw straight, curved and freehand paths without changing physical wiring", async ({
  page,
}) => {
  const before = (await project(page)).connections;
  const canvas = page.locator("canvas").first();
  const b = await canvas.boundingBox();
  for (const mode of ["Straight", "Curve"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.mouse.click(b.x + b.width * 0.2, b.y + 80);
    await page.mouse.click(b.x + b.width * 0.4, b.y + 140);
    await page.getByRole("button", { name: "Finish path" }).click();
    expect((await project(page)).geometry[0].kind).toBe(mode.toLowerCase());
  }
  await page.getByRole("button", { name: "Freehand", exact: true }).click();
  await page.mouse.move(b.x + 80, b.y + 130);
  await page.mouse.down();
  await page.mouse.move(b.x + 200, b.y + 200, { steps: 12 });
  await page.mouse.up();
  const s = await project(page);
  expect(s.geometry[0].kind).toBe("freehand");
  expect(s.geometry[0].points.length).toBeGreaterThan(4);
  expect(s.connections).toEqual(before);
});
test("save split presets and a paired scene, then restore a rig", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Save rig", exact: true }).click();
  await page
    .getByRole("button", { name: "Effect presets", exact: true })
    .click();
  await page.locator(".saveRow input").fill("Motion");
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await page
    .getByRole("button", { name: "Colour presets", exact: true })
    .click();
  await page.locator(".saveRow input").fill("Green");
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  await page.locator(".saveRow input").fill("Show one");
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  let s = await project(page);
  expect(s.scenes[0].effectId).toBe(s.effectPresets[0].id);
  expect(s.scenes[0].colourId).toBe(s.colourPresets[0].id);
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Scene loaded");
  await page.getByRole("link", { name: "Stage", exact: true }).click();
  await page.getByLabel("X position").fill("320");
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Rigs", exact: true }).click();
  await page.getByRole("button", { name: "Load", exact: true }).click();
  expect((await project(page)).geometry[0].x).toBe(140);
});
test("bad import leaves current work intact and damaged storage is retained for recovery", async ({
  page,
}) => {
  const before = await project(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toContainText("v2");
  expect(await project(page)).toEqual(before);
  await page.evaluate(
    (k) => localStorage.setItem(k, "broken original data"),
    key,
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("preserved");
  expect(
    await page.evaluate((k) => localStorage.getItem(k + "-recovery"), key),
  ).toBe("broken original data");
});
test("keyboard navigation, reduced motion and narrow layouts remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Your stage, in view." }),
    ).toBeVisible();
  }
});
test("profiles are editable as reusable copies without changing existing patch", async ({
  page,
}) => {
  const before = await project(page);
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page
    .locator(".libraryGrid article")
    .first()
    .getByRole("button", { name: "Edit as copy" })
    .click();
  await page.getByLabel("Profile name").fill("Long strip");
  await page.getByLabel("Pixel count").fill("120");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  const s = await project(page);
  expect(s.profiles.at(-1).pixels).toBe(120);
  expect(s.fixtures).toEqual(before.fixtures);
  expect(s.connections).toEqual(before.connections);
});
test("LAN-style nonsecure UUID fallback works and all resources stay local", async ({
  page,
}) => {
  const remote = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith(new URL(page.url()).origin) &&
      !r.url().startsWith("data:")
    )
      remote.push(r.url());
  });
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.reload();
  await page.getByText("Add fixture", { exact: true }).click();
  await page
    .getByRole("button", { name: "Create fixture", exact: true })
    .click();
  expect((await project(page)).fixtures).toHaveLength(4);
  expect(remote).toEqual([]);
});
test("responsive stage and palette settle without resize feedback oscillation", async ({
  page,
}) => {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const values = [];
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          values.push(
            document.querySelector(".paletteBar").getBoundingClientRect().top,
          );
        }
        return Math.max(...values) - Math.min(...values);
      }),
    )
    .toBeLessThan(1);
});
test("Stage, Patch and Library have no detected WCAG A/AA DOM violations", async ({
  page,
}) => {
  for (const name of ["Stage", "Patch", "Library"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.locator("main h1")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
