const $ = (id) => document.getElementById(id);
document.querySelector("main").inert = true;
let state,
  schemas = {},
  gradients = {},
  rigId = "",
  selected = new Set(),
  tab = "effects",
  busy = false;
let editingTheme = "",
  stops = [],
  mappings = {};
const clone = (value) => structuredClone(value);
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function notice(text, error = false) {
  $("notice").textContent = text;
  $("notice").className = error ? "error" : "";
}
async function request(path, method = "GET", body) {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok || data.status === "failed")
    throw new Error(
      data.payload?.reason || data.reason || `Request failed (${r.status})`,
    );
  return data;
}
async function run(fn, message) {
  if (busy) return;
  busy = true;
  document.body.setAttribute("aria-busy", "true");
  try {
    await fn();
    render();
    if (message) notice(message);
  } catch (e) {
    notice(e.message, true);
  } finally {
    busy = false;
    document.body.removeAttribute("aria-busy");
  }
}
async function refresh() {
  state = await request("/api/studio");
}
async function saveLibrary(data) {
  state = await request("/api/studio", "PUT", data);
}
async function apply(changes, message = "Changes applied") {
  await run(async () => {
    state = await request("/api/studio", "POST", { action: "apply", changes });
  }, message);
}
const rig = () => state.library.rigs[rigId];
const visibleIds = () =>
  (rig()?.virtuals || Object.keys(state.virtuals)).filter(
    (id) => state.virtuals[id],
  );
const chosen = () => visibleIds().filter((id) => selected.has(id));
const themeFor = (id) => state.library.themes[state.library.assignments[id]];
function button(text, fn, cls) {
  const n = el("button", text, cls);
  n.type = "button";
  n.onclick = fn;
  return n;
}
function nameFor(message, initial = "") {
  const value = prompt(message, initial);
  return value?.trim() || null;
}
function uuid() {
  return crypto.randomUUID();
}
function render() {
  renderRigs();
  renderCards();
  renderPanel();
  $("undo").disabled = !state.undo;
}
function renderRigs() {
  const list = $("rigList");
  list.replaceChildren();
  for (const [id, item] of Object.entries(state.library.rigs))
    list.append(
      button(
        item.name,
        () => {
          rigId = id;
          selected = new Set(item.selection || []);
          render();
          notice("Rig loaded. Other lights are unchanged.");
        },
        rigId === id ? "active" : "",
      ),
    );
  $("allRig").className = rigId ? "" : "active";
  $("rigTitle").textContent = rig()?.name || "All lights";
  $("rigTools").replaceChildren();
  if (rig()) {
    $("rigTools").append(
      button("Update rig from selection", () =>
        run(async () => {
          const data = clone(state.library);
          data.rigs[rigId].selection = chosen();
          await saveLibrary(data);
        }, "Rig selection saved"),
      ),
    );
    const layout = document.createElement("select");
    layout.setAttribute("aria-label", "Card layout");
    for (const [v, t] of [
      ["comfortable", "Comfortable cards"],
      ["compact", "Compact cards"],
    ])
      layout.add(new Option(t, v));
    layout.value = rig().layout || "comfortable";
    layout.onchange = () =>
      run(async () => {
        const data = clone(state.library);
        data.rigs[rigId].layout = layout.value;
        await saveLibrary(data);
      });
    $("rigTools").append(layout);
    $("rigTools").append(
      button("Rename rig", () => {
        const name = nameFor("Rig name", rig().name);
        if (name)
          run(async () => {
            const data = clone(state.library);
            data.rigs[rigId].name = name;
            await saveLibrary(data);
          });
      }),
      button("Delete rig", () => {
        if (confirm(`Delete ${rig().name}? Lights will keep running.`))
          run(async () => {
            const data = clone(state.library);
            delete data.rigs[rigId];
            await saveLibrary(data);
            rigId = "";
          });
      }),
    );
  }
  const groups = $("groupList");
  groups.replaceChildren();
  if (!rig())
    groups.append(
      el(
        "p",
        "Save a rig to define reusable roles, such as Strips or Washes.",
        "hint",
      ),
    );
  for (const [name, ids] of Object.entries(rig()?.groups || {})) {
    const row = el("div", undefined, "groupRow");
    row.append(
      button(`${name} · ${ids.length}`, () => {
        selected = new Set(ids);
        render();
      }),
      button(
        "×",
        () =>
          run(async () => {
            const data = clone(state.library);
            delete data.rigs[rigId].groups[name];
            await saveLibrary(data);
          }),
        "",
      ),
    );
    row.lastChild.setAttribute("aria-label", `Delete group ${name}`);
    groups.append(row);
  }
  $("addGroup").disabled = !rig() || !chosen().length;
}
function renderCards() {
  const ids = visibleIds(),
    query = $("search").value.toLowerCase();
  $("selectionCount").textContent =
    `${chosen().length} selected · ${ids.length} lights in view`;
  $("cards").className =
    "cards " + (rig()?.layout === "compact" ? "compact" : "");
  $("cards").replaceChildren();
  for (const id of ids) {
    const v = state.virtuals[id],
      name = v.config.name || id;
    if (
      !`${name} ${v.segments.map((s) => s[0]).join(" ")}`
        .toLowerCase()
        .includes(query)
    )
      continue;
    const card = button(
      "",
      () => {
        selected.has(id) ? selected.delete(id) : selected.add(id);
        render();
      },
      "card " + (selected.has(id) ? "selected" : ""),
    );
    card.setAttribute("aria-pressed", String(selected.has(id)));
    card.append(
      el("span", selected.has(id) ? "✓" : "○", "check"),
      el("strong", name),
      el(
        "small",
        `${v.pixel_count} pixels · ${v.active ? "On" : "Off"}${v.streaming ? " · Streaming" : ""}`,
      ),
      el("small", v.effect.name || "No effect"),
    );
    const theme = themeFor(id);
    if (theme) {
      const bar = el("div", undefined, "gradient");
      bar.style.background = theme.gradient;
      card.append(bar, el("small", theme.name));
    } else card.append(el("small", "Colours from current effect"));
    for (const [name, members] of Object.entries(rig()?.groups || {}))
      if (members.includes(id)) card.append(el("span", name, "badge"));
    $("cards").append(card);
  }
  if (!ids.length)
    $("cards").append(
      el(
        "p",
        "Create devices and virtuals in Classic LedFX to get started.",
        "empty",
      ),
    );
}
function renderPanel() {
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => (b.className = b.dataset.tab === tab ? "active" : ""));
  $("panel").replaceChildren();
  if (tab === "effects") renderEffects();
  if (tab === "colours") renderColours();
  if (tab === "presets") renderPresets();
}
function labelInput(title, input, help) {
  const label = el("label", title);
  label.append(input);
  if (help) label.append(el("div", help, "fieldHelp"));
  return label;
}
function renderEffects() {
  const panel = $("panel"),
    ids = chosen();
  panel.append(
    el(
      "h2",
      ids.length
        ? `Edit ${ids.length} selected light${ids.length === 1 ? "" : "s"}`
        : "Select lights to edit",
    ),
  );
  const picker = document.createElement("select");
  picker.add(new Option("Choose an effect…", ""));
  let category = "";
  let group;
  for (const [id, s] of Object.entries(schemas).sort((a, b) =>
    `${a[1].category} ${a[1].name}`.localeCompare(
      `${b[1].category} ${b[1].name}`,
    ),
  )) {
    if (category !== s.category) {
      category = s.category;
      group = document.createElement("optgroup");
      group.label = category || "Effects";
      picker.append(group);
    }
    group.append(new Option(s.name, id));
  }
  const types = [...new Set(ids.map((id) => state.virtuals[id].effect.type))];
  if (types.length === 1) picker.value = types[0] || "";
  picker.disabled = !ids.length;
  picker.onchange = () => {
    if (picker.value)
      apply(
        ids.map((id) => ({ id, type: picker.value })),
        "Effect applied. Assigned themes retained.",
      );
  };
  panel.append(labelInput("Effect", picker));
  if (!ids.length) return;
  if (types.length !== 1 || !types[0]) {
    panel.append(
      el("p", "Choose a shared effect to edit its settings.", "hint"),
    );
    return;
  }
  const type = types[0],
    schema = schemas[type];
  if (!schema) return;
  panel.append(
    el(
      "p",
      "Changes apply live. Only the setting you edit is changed.",
      "hint",
    ),
  );
  const props = schema.schema.properties,
    advanced = el("details");
  advanced.append(el("summary", "Advanced settings"));
  for (const [key, s] of Object.entries(props)) {
    if (
      key === "advanced" ||
      key in state.color_fields[type] ||
      (schema.hidden_keys || []).includes(key)
    )
      continue;
    const vals = ids.map(
        (id) => state.virtuals[id].effect.config[key] ?? s.default,
      ),
      same = vals.every((v) => JSON.stringify(v) === JSON.stringify(vals[0]));
    let input;
    if (s.enum) {
      input = document.createElement("select");
      if (!same) input.add(new Option("Mixed", ""));
      for (const value of s.enum)
        input.add(new Option(String(value), String(value)));
      if (same) input.value = String(vals[0]);
      input.onchange = () =>
        apply(
          ids.map((id) => ({
            id,
            config: { [key]: s.enum.find((v) => String(v) === input.value) },
          })),
        );
    } else if (s.type === "boolean") {
      input = document.createElement("select");
      if (!same) input.add(new Option("Mixed", ""));
      input.add(new Option("On", "true"));
      input.add(new Option("Off", "false"));
      if (same) input.value = String(vals[0]);
      input.onchange = () =>
        apply(
          ids.map((id) => ({ id, config: { [key]: input.value === "true" } })),
        );
    } else if (["number", "integer", "string"].includes(s.type)) {
      input = document.createElement("input");
      input.type = s.type === "string" ? "text" : "number";
      if (same) input.value = vals[0] ?? "";
      else input.placeholder = "Mixed";
      if (s.minimum !== undefined) input.min = s.minimum;
      if (s.maximum !== undefined) input.max = s.maximum;
      input.step = s.type === "integer" ? "1" : "any";
      input.onchange = () => {
        if (!input.reportValidity()) return;
        const value = s.type === "string" ? input.value : Number(input.value);
        if (input.value !== "")
          apply(ids.map((id) => ({ id, config: { [key]: value } })));
      };
    } else continue;
    const field = labelInput(key.replaceAll("_", " "), input, s.description);
    ((schema.advanced_keys || []).includes(key) ? advanced : panel).append(
      field,
    );
  }
  if (advanced.children.length > 1) panel.append(advanced);
  panel.append(
    button(
      "Clear effect on selected lights",
      () => apply(ids.map((id) => ({ id, clear: true }))),
      "full",
    ),
  );
}
function renderColours() {
  const panel = $("panel");
  panel.append(
    el("h2", "Colour themes"),
    el(
      "p",
      "Apply a gradient and matching swatches to selected lights. Themes follow lights when effects change.",
      "hint",
    ),
    button("＋ Create theme", () => openTheme(), "full"),
  );
  for (const [id, theme] of Object.entries(state.library.themes)) {
    const item = el("div", undefined, "theme");
    item.append(el("strong", theme.name));
    const preview = el("div", undefined, "gradient");
    preview.style.background = theme.gradient;
    item.append(preview);
    const row = el("div", undefined, "row"),
      use = button(`Apply to ${chosen().length}`, () =>
        apply(chosen().map((v) => ({ id: v, theme: id }))),
      );
    use.disabled = !chosen().length;
    row.append(
      use,
      button("Edit", () => openTheme(id)),
    );
    item.append(row);
    panel.append(item);
  }
  if (!Object.keys(state.library.themes).length)
    panel.append(
      el(
        "p",
        "Create your first theme, then select two strips and apply it. Select the third strip to give it a different theme.",
        "empty",
      ),
    );
}
function changesForColour(preset) {
  const targets = new Map();
  for (const [role, theme] of Object.entries(preset.groups || {}))
    for (const id of rig()?.groups?.[role] || [])
      if (visibleIds().includes(id)) targets.set(id, theme);
  for (const [id, theme] of Object.entries(preset.overrides || {}))
    if (visibleIds().includes(id)) targets.set(id, theme);
  return [...targets].map(([id, theme]) => ({ id, theme }));
}
function changesForEffect(preset) {
  return Object.entries(preset.virtuals)
    .filter(([id]) => visibleIds().includes(id))
    .map(([id, effect]) =>
      effect
        ? { id, type: effect.type, config: effect.config }
        : { id, clear: true },
    );
}
function presetCard(name, onApply, onDelete) {
  const n = el("div", undefined, "preset");
  n.append(el("strong", name));
  const row = el("div", undefined, "row");
  row.append(button("Load", onApply), button("Delete", onDelete));
  n.append(row);
  return n;
}
function deletePreset(collection, id) {
  if (confirm("Delete this preset?"))
    run(async () => {
      const data = clone(state.library);
      if (
        Object.values(data.scenes).some(
          (s) => s.effect === id || s.color === id,
        )
      )
        throw new Error("Delete paired scenes using this preset first.");
      delete data[collection][id];
      await saveLibrary(data);
    });
}
function renderPresets() {
  const panel = $("panel");
  panel.append(
    el(
      "p",
      "Load presets into the current rig. Lights outside it stay unchanged. Existing scenes remain in Classic LedFX.",
      "hint",
    ),
    el("h2", "Effect arrangements"),
    button(
      "Save selected effects",
      () => {
        const ids = chosen(),
          name = nameFor("Effect arrangement name");
        if (!name) return;
        run(async () => {
          if (!ids.length) throw new Error("Select lights first");
          const data = clone(state.library),
            virtuals = {};
          for (const id of ids) {
            const effect = state.virtuals[id].effect;
            virtuals[id] = effect.type
              ? {
                  type: effect.type,
                  config: Object.fromEntries(
                    Object.entries(effect.config).filter(
                      ([k]) => !(k in state.color_fields[effect.type]),
                    ),
                  ),
                }
              : null;
          }
          data.effect_presets[uuid()] = { name, virtuals };
          await saveLibrary(data);
        }, "Effect arrangement saved");
      },
      "full",
    ),
  );
  for (const [id, p] of Object.entries(state.library.effect_presets))
    panel.append(
      presetCard(
        p.name,
        () =>
          apply(
            changesForEffect(p),
            "Effect arrangement loaded. Themes retained.",
          ),
        () => deletePreset("effect_presets", id),
      ),
    );
  panel.append(
    el("h2", "Colour arrangements"),
    button(
      "Save rig colours",
      () => {
        const name = nameFor("Colour arrangement name");
        if (!name) return;
        run(async () => {
          const data = clone(state.library),
            groups = {},
            overrides = {},
            covered = new Set();
          for (const [role, members] of Object.entries(rig()?.groups || {})) {
            const assignments = members.map((id) => data.assignments[id]);
            if (
              assignments.length &&
              assignments[0] &&
              assignments.every((t) => t === assignments[0])
            ) {
              groups[role] = assignments[0];
              members.forEach((id) => covered.add(id));
            }
          }
          for (const id of visibleIds())
            if (data.assignments[id] && !covered.has(id))
              overrides[id] = data.assignments[id];
          if (!Object.keys(groups).length && !Object.keys(overrides).length)
            throw new Error("Assign colour themes before saving");
          data.color_presets[uuid()] = { name, groups, overrides };
          await saveLibrary(data);
        }, "Colour arrangement saved");
      },
      "full",
    ),
  );
  for (const [id, p] of Object.entries(state.library.color_presets))
    panel.append(
      presetCard(
        p.name,
        () => apply(changesForColour(p), "Colour arrangement loaded"),
        () => deletePreset("color_presets", id),
      ),
    );
  panel.append(el("h2", "Paired scenes"));
  const effect = document.createElement("select"),
    color = document.createElement("select");
  for (const [id, p] of Object.entries(state.library.effect_presets))
    effect.add(new Option(p.name, id));
  for (const [id, p] of Object.entries(state.library.color_presets))
    color.add(new Option(p.name, id));
  panel.append(
    labelInput("Effect arrangement", effect),
    labelInput("Colour arrangement", color),
  );
  const save = button(
    "Save paired scene",
    () => {
      const name = nameFor("Scene name");
      if (name)
        run(async () => {
          const data = clone(state.library);
          data.scenes[uuid()] = {
            name,
            effect: effect.value,
            color: color.value,
          };
          await saveLibrary(data);
        }, "Scene saved");
    },
    "full",
  );
  save.disabled = !effect.value || !color.value;
  panel.append(save);
  for (const [id, p] of Object.entries(state.library.scenes))
    panel.append(
      presetCard(
        p.name,
        () => {
          const combined = new Map(
            changesForEffect(state.library.effect_presets[p.effect]).map(
              (c) => [c.id, c],
            ),
          );
          for (const c of changesForColour(
            state.library.color_presets[p.color],
          ))
            combined.set(c.id, { ...combined.get(c.id), ...c });
          apply([...combined.values()], "Scene loaded");
        },
        () => deletePreset("scenes", id),
      ),
    );
}
function parseGradient(text) {
  const matches = [
    ...text.matchAll(
      /(#[0-9a-f]{6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))\s+([\d.]+)%/gi,
    ),
  ];
  if (matches.length < 2)
    throw new Error(
      "Use at least two RGB or six-digit hex stops with percentage positions",
    );
  return matches.map((m) => ({
    color: m[1].startsWith("#")
      ? m[1]
      : "#" +
        m[1]
          .match(/\d+/g)
          .map((n) =>
            Math.max(0, Math.min(255, Number(n)))
              .toString(16)
              .padStart(2, "0"),
          )
          .join(""),
    position: Number(m[2]),
  }));
}
function gradient() {
  return `linear-gradient(90deg, ${[...stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ")})`;
}
function preview() {
  $("gradientPreview").style.background = gradient();
}
function renderStops() {
  $("stops").replaceChildren();
  stops.forEach((s, i) => {
    const row = el("div", undefined, "stop"),
      color = document.createElement("input"),
      position = document.createElement("input");
    color.type = "color";
    color.value = s.color;
    color.setAttribute("aria-label", `Stop ${i + 1} colour`);
    color.oninput = () => {
      s.color = color.value;
      preview();
    };
    position.type = "number";
    position.min = 0;
    position.max = 100;
    position.step = "any";
    position.value = s.position;
    position.setAttribute("aria-label", `Stop ${i + 1} position (%)`);
    position.oninput = () => {
      s.position = Number(position.value);
      preview();
    };
    row.append(
      color,
      position,
      button("×", () => {
        if (stops.length > 2) {
          stops.splice(i, 1);
          renderStops();
        }
      }),
    );
    row.lastChild.setAttribute("aria-label", `Remove stop ${i + 1}`);
    $("stops").append(row);
  });
  preview();
}
function suggest() {
  const colors = [...stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => s.color)
    .filter((c) => c.toLowerCase() !== "#000000");
  $("primary").value = colors[0] || "#ffffff";
  $("accent").value = colors.at(-1) || "#ffffff";
}
function renderMappings() {
  const type = $("mappingEffect").value,
    fields = state.color_fields[type] || {};
  $("mappingFields").replaceChildren();
  for (const [key, role] of Object.entries(fields)) {
    const select = document.createElement("select");
    select.add(new Option(`Automatic (${role})`, ""));
    for (const r of ["gradient", "primary", "accent", "background"])
      select.add(new Option(r, r));
    select.value = mappings[type]?.[key] || "";
    select.onchange = () => {
      mappings[type] ??= {};
      if (select.value) mappings[type][key] = select.value;
      else delete mappings[type][key];
    };
    $("mappingFields").append(labelInput(key.replaceAll("_", " "), select));
  }
  if (!Object.keys(fields).length)
    $("mappingFields").append(
      el("p", "This effect has no theme colour fields.", "hint"),
    );
}
function openTheme(id = "") {
  editingTheme = id;
  const theme = state.library.themes[id];
  $("themeName").value = theme?.name || "";
  $("themeHeading").textContent = theme
    ? "Edit colour theme"
    : "Create colour theme";
  $("themeError").textContent = "";
  $("gradientText").value = "";
  mappings = clone(theme?.mappings || {});
  stops = parseGradient(
    theme?.gradient || "linear-gradient(90deg, #ff206e 0%, #6c5cff 100%)",
  );
  $("gradientSource").replaceChildren(new Option("Custom gradient", ""));
  for (const [name, g] of Object.entries(gradients))
    if (typeof g === "string") $("gradientSource").add(new Option(name, name));
  $("mappingEffect").replaceChildren();
  for (const [type, s] of Object.entries(schemas).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  ))
    $("mappingEffect").add(new Option(s.name, type));
  const selectedType = state.virtuals[chosen()[0]]?.effect.type;
  if (selectedType) $("mappingEffect").value = selectedType;
  renderMappings();
  renderStops();
  suggest();
  $("background").value = theme?.background || "#000000";
  if (theme) {
    $("primary").value = theme.primary;
    $("accent").value = theme.accent;
  }
  $("themeDialog").showModal();
}
$("themeForm").onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  busy = true;
  try {
    const data = clone(state.library),
      id = editingTheme || uuid();
    data.themes[id] = {
      name: $("themeName").value.trim(),
      gradient: gradient(),
      primary: $("primary").value,
      accent: $("accent").value,
      background: $("background").value,
      mappings,
    };
    await saveLibrary(data);
    $("themeDialog").close();
    render();
    notice("Theme saved. Apply it to update selected lights.");
  } catch (e) {
    $("themeError").textContent = e.message;
  } finally {
    busy = false;
  }
};
$("cancelTheme").onclick = () => $("themeDialog").close();
$("mappingEffect").onchange = renderMappings;
$("suggest").onclick = suggest;
$("addStop").onclick = () => {
  stops.push({ color: "#ffffff", position: 50 });
  renderStops();
};
$("importGradient").onclick = () => {
  try {
    stops = parseGradient($("gradientText").value);
    renderStops();
    suggest();
    $("themeError").textContent = "";
  } catch (e) {
    $("themeError").textContent = e.message;
  }
};
$("gradientSource").onchange = () => {
  try {
    if ($("gradientSource").value) {
      stops = parseGradient(gradients[$("gradientSource").value]);
      renderStops();
      suggest();
    }
  } catch (e) {
    $("themeError").textContent = e.message;
  }
};
$("allRig").onclick = () => {
  rigId = "";
  selected.clear();
  render();
};
$("selectAll").onclick = () => {
  selected = new Set(visibleIds());
  render();
};
$("selectNone").onclick = () => {
  selected.clear();
  render();
};
$("search").oninput = renderCards;
$("refresh").onclick = () => run(initialize, "Refreshed");
$("undo").onclick = () =>
  run(async () => {
    state = await request("/api/studio", "POST", { action: "undo" });
  }, "Last light edit undone");
$("saveRig").onclick = () => {
  const ids = chosen();
  if (!ids.length) {
    notice("Select the lights to include in your rig", true);
    return;
  }
  const name = nameFor("Rig name");
  if (name)
    run(async () => {
      const data = clone(state.library),
        id = uuid();
      data.rigs[id] = {
        name,
        virtuals: ids,
        selection: ids,
        groups: {},
        layout: "comfortable",
      };
      await saveLibrary(data);
      rigId = id;
    }, "Rig saved");
};
$("addGroup").onclick = () => {
  if (!rig() || !chosen().length) return;
  const name = nameFor("Group / role name (reuse the same name in other rigs)");
  if (name)
    run(async () => {
      const data = clone(state.library);
      data.rigs[rigId].groups[name] = chosen();
      await saveLibrary(data);
    }, "Group saved");
};
document.querySelectorAll("[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.tab;
      renderPanel();
    }),
);
async function initialize() {
  await refresh();
  const [schema, colors] = await Promise.all([
    request("/api/schema"),
    request("/api/colors"),
  ]);
  schemas = schema.effects;
  gradients = { ...colors.gradients.builtin, ...colors.gradients.user };
  document.querySelector("main").inert = false;
}
await run(initialize, "Ready — select lights to begin");
setInterval(async () => {
  if (busy || !state) return;
  try {
    await refresh();
    renderCards();
    $("undo").disabled = !state.undo;
  } catch (e) {
    notice("Connection lost. " + e.message, true);
  }
}, 4000);
