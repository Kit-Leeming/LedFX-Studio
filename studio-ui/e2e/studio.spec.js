import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyWorkspace } from "../src/domain.js";
function fixture() {
  return {
    workspace_version: 3,
    status: "success",
    library: {
      version: 1,
      revision: 0,
      rigs: {},
      themes: {},
      effect_presets: {},
      color_presets: {},
      scenes: {},
      assignments: {},
    },
    undo: 0,
    virtuals: {
      strip: {
        id: "strip",
        is_device: "dev1",
        config: { name: "Strip output" },
        pixel_count: 60,
        effect: {
          type: "singleColor",
          name: "Solid",
          config: { brightness: 1, color: "#ffffff" },
        },
      },
      matrix: {
        id: "matrix",
        is_device: "dev2",
        config: { name: "Matrix output", rows: 16 },
        pixel_count: 256,
        effect: {
          type: "singleColor",
          name: "Solid",
          config: { brightness: 1 },
        },
      },
    },
    color_fields: {
      singleColor: { color: "primary" },
      energy: { gradient: "gradient" },
    },
  };
}
const schema = {
  effects: {
    singleColor: {
      name: "Solid",
      schema: {
        properties: {
          brightness: { type: "number", minimum: 0, maximum: 1, default: 1 },
          color: { type: "string" },
        },
      },
    },
    energy: {
      name: "Energy",
      schema: {
        properties: {
          brightness: { type: "number", minimum: 0, maximum: 1, default: 1 },
          gradient: { type: "string" },
        },
      },
    },
  },
};
test.beforeEach(async ({ page }) => {
  const state = fixture(),
    posts = [],
    history = [];
  page.demo = { state, posts, fail: false };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname,
      method = route.request().method();
    let body;
    try {
      body = route.request().postDataJSON();
    } catch {}
    if (path === "/api/schema") return route.fulfill({ json: schema });
    if (path === "/api/devices")
      return route.fulfill({ json: { status: "success", devices: {} } });
    if (path !== "/api/studio")
      throw Error("Unexpected hardware API request " + path);
    if (method === "PUT") {
      if (page.demo.fail || body.revision !== state.library.revision)
        return route.fulfill({
          status: 400,
          json: {
            status: "failed",
            payload: {
              reason:
                "Studio changed in another window. Refresh before saving.",
            },
          },
        });
      state.library = { ...body, revision: body.revision + 1 };
    }
    if (method === "POST") {
      posts.push(body);
      if (body.action === "apply") {
        history.push(structuredClone(state));
        for (const c of body.changes) {
          state.virtuals[c.id].effect = {
            ...state.virtuals[c.id].effect,
            type: c.type || state.virtuals[c.id].effect.type,
            config: { ...state.virtuals[c.id].effect.config, ...c.config },
          };
          if (c.theme) state.library.assignments[c.id] = c.theme;
        }
        if (body.workspace) state.library.workspace = body.workspace;
        state.library.revision++;
        state.undo = history.length;
      } else {
        Object.assign(state, history.pop());
      }
    }
    return route.fulfill({ json: state });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Devices", exact: true }),
  ).toBeVisible();
});
async function addLight(
  page,
  {
    name = "Left strip",
    integrated = false,
    matrix = false,
    bind = false,
  } = {},
) {
  await page.getByRole("link", { name: "Devices", exact: true }).click();
  await page.getByRole("tab", { name: /Lights/ }).click();
  await page.getByRole("button", { name: "Add light", exact: true }).click();
  await page.getByLabel("Light name", { exact: true }).fill(name);
  if (matrix) {
    await page.getByLabel("Light type").selectOption("matrix");
    await page.getByLabel("Physical width (m)").fill("2");
    await page.getByLabel("Physical height (m)").fill("1");
  } else await page.getByLabel("Physical strip length (m)").fill("2");
  if (integrated)
    await page.getByLabel("Controller arrangement").selectOption("integrated");
  else
    await page
      .getByLabel("Chipset / output protocol", { exact: true })
      .fill("SM16703");
  if (bind || integrated)
    await page
      .getByLabel("Existing LedFX virtual")
      .selectOption(matrix ? "matrix" : "strip");
  await page.getByRole("button", { name: "Save light", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function addController(page) {
  await page.getByRole("link", { name: "Devices", exact: true }).click();
  await page.getByRole("tab", { name: /Controllers/ }).click();
  await page
    .getByRole("button", { name: "Add controller", exact: true })
    .click();
  await page
    .getByLabel("Controller name", { exact: true })
    .fill("Stage controller");
  await page
    .getByLabel("Output 1 Chipset / output protocol", { exact: true })
    .fill("SM16703");
  await page
    .getByRole("button", { name: "Save controller", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function place(page, name = "Left strip") {
  await page.getByRole("link", { name: "Stage", exact: true }).click();
  await page.getByLabel("Light to place").selectOption({ label: name });
  await page
    .getByRole("button", { name: "Place on stage", exact: true })
    .click();
  await expect(page.getByLabel("X position (m)")).toBeVisible();
}
test("four sections, independent light definitions and explicit Save/Cancel", async ({
  page,
}) => {
  await expect(page.getByRole("navigation")).toContainText("Devices");
  await expect(page.getByRole("navigation")).toContainText("Patches");
  await expect(page.getByRole("button", { name: /Equipment/ })).toHaveCount(0);
  await addLight(page);
  expect(page.demo.state.library.workspace.controllers).toHaveLength(0);
  await page.getByRole("button", { name: "Edit light" }).click();
  await page.getByLabel("Light name", { exact: true }).fill("Uncommitted");
  expect(page.demo.state.library.workspace.lights[0].name).toBe("Left strip");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Left strip", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Left strip", exact: true }),
  ).toBeVisible();
});
test("built-in-controller matrix requires a supported output and bypasses Patches", async ({
  page,
}) => {
  await addLight(page, { name: "Curtain", integrated: true, matrix: true });
  const w = page.demo.state.library.workspace;
  expect(w.lights[0].connection).toBe("integrated");
  expect(w.lights[0].columns * w.lights[0].rows).toBe(256);
  await page.getByRole("link", { name: "Patches", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No standalone lights to patch" }),
  ).toBeVisible();
  await place(page, "Curtain");
  expect(page.demo.state.library.workspace.placements).toHaveLength(1);
});
test("patch standalone light, reject wrong voltage and unpatch without losing light", async ({
  page,
}) => {
  await addLight(page);
  await addController(page);
  await page.getByRole("link", { name: "Patches", exact: true }).click();
  await page.getByRole("button", { name: /Left strip/ }).click();
  await page
    .getByLabel("Controller", { exact: true })
    .selectOption({ label: "Stage controller" });
  const output = page.demo.state.library.workspace.controllers[0].outputs[0];
  await page.getByLabel("Output", { exact: true }).selectOption(output.id);
  await page.getByLabel("Start pixel (1-based)").fill("290");
  await page.getByRole("button", { name: "Save patch", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("does not fit");
  await page.getByLabel("Start pixel (1-based)").fill("1");
  await page.getByRole("button", { name: "Save patch", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Patch saved");
  expect(page.demo.state.library.workspace.patches).toHaveLength(1);
  await page.getByRole("button", { name: "Unpatch", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("unpatched");
  expect(page.demo.state.library.workspace.lights).toHaveLength(1);
});
test("stage keeps physical length while bending, rotating, locking and removing", async ({
  page,
}) => {
  await addLight(page);
  await place(page);
  await page.getByLabel("Strip bend (°)").fill("90");
  await page.getByLabel("Rotation (°)").fill("10");
  expect(page.demo.state.library.workspace.placements[0].bend).toBe(0);
  await page
    .getByRole("button", { name: "Save position", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("placement saved");
  expect(page.demo.state.library.workspace.lights[0].length).toBe(2);
  expect(page.demo.state.library.workspace.placements[0].bend).toBe(90);
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(page.getByLabel("X position (m)")).toBeDisabled();
  await page.getByRole("button", { name: "Remove from stage" }).click();
  await expect(page.getByRole("status")).toContainText("Removed from Stage");
  expect(page.demo.state.library.workspace.lights).toHaveLength(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("undone");
  expect(page.demo.state.library.workspace.placements).toHaveLength(1);
});
test("out-of-bounds placement and smaller stage retain existing geometry", async ({
  page,
}) => {
  await addLight(page);
  await place(page);
  await page.getByLabel("X position (m)").fill("7");
  await page
    .getByRole("button", { name: "Save position", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("beyond");
  expect(page.demo.state.library.workspace.placements[0].x).toBe(0.25);
  await page
    .getByRole("button", { name: "Stage dimensions", exact: true })
    .click();
  await page.getByLabel("Stage width (m)").fill("1");
  await page
    .getByRole("button", { name: "Save dimensions", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "beyond",
  );
  expect(page.demo.state.library.workspace.stage.width).toBe(8);
});
test("effects use real API payloads and read-only stage; palette scope applies atomically", async ({
  page,
}) => {
  await addLight(page, { bind: true });
  await place(page);
  await page
    .getByRole("link", { name: "Effects & palettes", exact: true })
    .click();
  await expect(page.getByLabel("X position (m)")).toHaveCount(0);
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByLabel("Effect type").selectOption("energy");
  await page.getByLabel("brightness", { exact: true }).fill("0.5");
  expect(page.demo.posts).toHaveLength(0);
  await page.getByRole("button", { name: "Apply effect to selection" }).click();
  await expect(page.getByRole("status")).toContainText("Effect applied");
  expect(page.demo.posts[0].changes[0].config.brightness).toBe(0.5);
  await page.getByRole("button", { name: "New palette", exact: true }).click();
  await page.getByLabel("Palette name").fill("Ocean");
  await page.getByRole("button", { name: "Save palette", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Apply palette", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Palette applied");
  const payload = page.demo.posts.at(-1);
  expect(payload.workspace.globalPalette).toBeTruthy();
  expect(payload.changes[0].theme).toBe(payload.workspace.globalPalette);
  expect(JSON.stringify(payload)).not.toMatch(/independent_uv|white_level/);
});
test("conflict leaves the open device draft intact for recovery", async ({
  page,
}) => {
  await addLight(page);
  await page.getByRole("button", { name: "Edit light" }).click();
  await page.getByLabel("Light name", { exact: true }).fill("Keep this draft");
  page.demo.fail = true;
  await page.getByRole("button", { name: "Save light", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "another window",
  );
  await expect(page.getByLabel("Light name", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  expect(page.demo.state.library.workspace.lights[0].name).toBe("Left strip");
});
test("group creation, edit and delete preserve lights", async ({ page }) => {
  await addLight(page, { bind: true });
  await page
    .getByRole("link", { name: "Effects & palettes", exact: true })
    .click();
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByRole("button", { name: "Save selection as group" }).click();
  await page.getByLabel("Group name").fill("Strips");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Strips", exact: true }).click();
  await page.getByRole("button", { name: "Delete group", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(page.demo.state.library.workspace.groups).toHaveLength(0);
  expect(page.demo.state.library.workspace.lights).toHaveLength(1);
});
test("keyboard, mobile layout and four-view accessibility", async ({
  page,
}) => {
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await addLight(page, { bind: true });
  for (const name of ["Devices", "Patches", "Stage", "Effects & palettes"]) {
    await page.getByRole("link", { name, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
