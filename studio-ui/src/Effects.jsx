import React, { useState } from "react";
import { Field, Modal, Empty, ErrorBox } from "./components";
import { uid } from "./domain";
import { Canvas } from "./StageView";
export default function Effects({
  workspace: w,
  selected,
  setSelected,
  save,
  busy,
  engine,
  schemas,
  apply,
  saveLibrary,
}) {
  const [effect, setEffect] = useState(""),
    [config, setConfig] = useState({}),
    [error, setError] = useState(""),
    [scope, setScope] = useState("global"),
    [palette, setPalette] = useState(""),
    [theme, setTheme] = useState(null),
    [group, setGroup] = useState(null);
  const themes = engine.library.themes,
    chosen = w.lights.filter((l) => selected.includes(l.id)),
    schema = schemas[effect],
    colorFields = engine.color_fields[effect] || {};
  const colors = Object.fromEntries(
    w.lights.map((l) => [
      l.id,
      themes[w.overrides[l.id] || w.globalPalette]?.primary || "#7ee6ca",
    ]),
  );
  async function applyEffect(e) {
    e.preventDefault();
    try {
      if (!effect || !chosen.length)
        throw Error("Select lights and an effect first.");
      await apply(
        chosen.map((l) => ({ id: l.virtualId, type: effect, config })),
        chosen,
        "Effect applied to selected lights.",
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function applyPalette() {
    try {
      if (!themes[palette]) throw Error("Choose a palette first.");
      const targets = scope === "global" ? w.lights : chosen;
      if (!targets.length) throw Error("Select lights first.");
      const next = {
        ...w,
        globalPalette: scope === "global" ? palette : w.globalPalette,
        overrides:
          scope === "global"
            ? w.overrides
            : {
                ...w.overrides,
                ...Object.fromEntries(chosen.map((l) => [l.id, palette])),
              },
      };
      await apply(
        targets.map((l) => ({
          id: l.virtualId,
          theme: next.overrides[l.id] || next.globalPalette,
        })),
        targets,
        "Palette applied.",
        next,
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function settings(advanced) {
    return Object.entries(schema?.schema.properties || {})
      .filter(
        ([k, s]) =>
          !colorFields[k] &&
          k !== "advanced" &&
          !(schema.hidden_keys || []).includes(k) &&
          Boolean((schema.advanced_keys || []).includes(k)) === advanced &&
          ["number", "integer", "string", "boolean"].includes(s.type),
      )
      .map(([key, s]) => {
        const old = chosen
          .map((l) => engine.virtuals[l.virtualId]?.effect)
          .filter(Boolean);
        const current =
          old.length === chosen.length &&
          old.every(
            (x) =>
              x.type === effect &&
              JSON.stringify(x.config?.[key]) ===
                JSON.stringify(old[0].config?.[key]),
          )
            ? old[0]?.config?.[key]
            : undefined;
        const value =
          key in config ? config[key] : (current ?? s.default ?? "");
        return (
          <Field
            key={key}
            label={key.replaceAll("_", " ")}
            hint={s.description}
          >
            {s.enum || s.type === "boolean" ? (
              <select
                value={String(value)}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    [key]:
                      s.type === "boolean"
                        ? e.target.value === "true"
                        : s.enum.find((v) => String(v) === e.target.value),
                  })
                }
              >
                <option disabled value="">
                  Mixed / default
                </option>
                {(s.enum || [true, false]).map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {String(v)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={s.type === "string" ? "text" : "number"}
                step={s.type === "integer" ? 1 : "any"}
                min={s.minimum}
                max={s.maximum}
                value={value}
                placeholder="Mixed / default"
                onChange={(e) =>
                  setConfig({
                    ...config,
                    [key]:
                      s.type === "string"
                        ? e.target.value
                        : e.target.value === ""
                          ? ""
                          : Number(e.target.value),
                  })
                }
              />
            )}
          </Field>
        );
      });
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <h1>Effects & palettes</h1>
          <p>
            Select lights here. The stage is a selection view and cannot be
            moved.
          </p>
        </div>
        <span className="tag">{chosen.length} selected</span>
      </div>
      {!w.lights.length ? (
        <Empty title="Add your lights first">
          Create lights in Devices, then place them on Stage and return here to
          apply effects.
        </Empty>
      ) : (
        <>
          <div className="effectsLayout">
            <section>
              <div className="panel canvasPanel">
                <Canvas
                  workspace={w}
                  selected={selected}
                  setSelected={setSelected}
                  readOnly
                  colors={colors}
                />
              </div>
              <section className="panel selectionPanel">
                <div className="sectionTitle">
                  <h2>Lights</h2>
                  <div className="actions">
                    <button
                      onClick={() => setSelected(w.lights.map((l) => l.id))}
                    >
                      Select all
                    </button>
                    <button onClick={() => setSelected([])}>Clear</button>
                  </div>
                </div>
                <div className="selectionGrid">
                  {w.lights.map((l) => (
                    <label key={l.id} className="check lightCheck">
                      <input
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, l.id]
                              : selected.filter((x) => x !== l.id),
                          )
                        }
                      />
                      <span>
                        <strong>{l.name}</strong>
                        <small>
                          {engine.virtuals[l.virtualId]?.effect.name ||
                            (!l.virtualId
                              ? "Control not configured"
                              : "No active effect")}
                          {w.overrides[l.id] ? " · local palette" : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="sectionTitle">
                  <h3>Groups</h3>
                  <button
                    disabled={!chosen.length}
                    onClick={() =>
                      setGroup({
                        id: uid(),
                        name: "",
                        lightIds: chosen.map((l) => l.id),
                      })
                    }
                  >
                    Save selection as group
                  </button>
                </div>
                <div className="groupChips">
                  {w.groups.map((g) => (
                    <div key={g.id}>
                      <button onClick={() => setSelected(g.lightIds)}>
                        {g.name} · {g.lightIds.length}
                      </button>
                      <button
                        aria-label={`Edit ${g.name}`}
                        onClick={() => setGroup(structuredClone(g))}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </section>
            <aside className="panel lookPanel">
              <ErrorBox>{error}</ErrorBox>
              <form onSubmit={applyEffect}>
                <h2>Effect</h2>
                <Field label="Effect type">
                  <select
                    required
                    value={effect}
                    onChange={(e) => {
                      setEffect(e.target.value);
                      setConfig({});
                    }}
                  >
                    <option value="">Choose an effect</option>
                    {Object.entries(schemas)
                      .sort((a, b) => a[1].name.localeCompare(b[1].name))
                      .map(([id, s]) => (
                        <option key={id} value={id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </Field>
                {effect && (
                  <>
                    <div>{settings(false)}</div>
                    <details>
                      <summary>Advanced effect settings</summary>
                      {settings(true)}
                    </details>
                  </>
                )}
                <button
                  className="primary wide"
                  type="submit"
                  disabled={busy || !chosen.length || !effect}
                >
                  Apply effect to selection
                </button>
                <p className="footnote">
                  Settings are sent only when you apply. Palette assignments are
                  preserved.
                </p>
              </form>
              <section>
                <h2>Palette</h2>
                <Field label="Palette scope">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="global">
                      All registered lights · default
                    </option>
                    <option value="selection">
                      Selected lights · local override
                    </option>
                  </select>
                </Field>
                <Field label="Colour palette">
                  <select
                    value={palette}
                    onChange={(e) => setPalette(e.target.value)}
                  >
                    <option value="">Choose a palette</option>
                    {Object.entries(themes).map(([id, t]) => (
                      <option key={id} value={id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {themes[palette] && (
                  <div
                    className="gradientPreview"
                    style={{ background: themes[palette].gradient }}
                  />
                )}
                <button
                  className="wide"
                  disabled={busy || !palette}
                  onClick={applyPalette}
                >
                  Apply palette
                </button>
                <div className="actions">
                  <button
                    onClick={() =>
                      setTheme({
                        id: uid(),
                        name: "",
                        primary: "#55d6bb",
                        accent: "#6c8cff",
                        background: "#000000",
                        mappings: {},
                      })
                    }
                  >
                    New palette
                  </button>
                  <button
                    disabled={!palette}
                    onClick={() =>
                      setTheme({
                        ...structuredClone(themes[palette]),
                        id: palette,
                      })
                    }
                  >
                    Edit
                  </button>
                </div>
                <button
                  className="textButton"
                  disabled={busy || !chosen.some((l) => w.overrides[l.id])}
                  onClick={async () => {
                    try {
                      if (!w.globalPalette)
                        throw Error("Apply a global palette first.");
                      const next = {
                        ...w,
                        overrides: Object.fromEntries(
                          Object.entries(w.overrides).filter(
                            ([id]) => !selected.includes(id),
                          ),
                        ),
                      };
                      await apply(
                        chosen.map((l) => ({
                          id: l.virtualId,
                          theme: w.globalPalette,
                        })),
                        chosen,
                        "Selected lights now follow the global palette.",
                        next,
                      );
                      setError("");
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Reset selection to global palette
                </button>
                <p className="footnote">
                  Global changes preserve local overrides. Palette fields never
                  set independent UV output.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
      {theme && (
        <Modal
          title="Colour palette"
          onClose={() => setTheme(null)}
          busy={busy}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (!theme.name.trim()) throw Error("Enter a palette name.");
                const { id, ...entry } = theme;
                entry.gradient = `linear-gradient(90deg, ${theme.primary} 0%, ${theme.accent} 100%)`;
                await saveLibrary(
                  { ...engine.library, themes: { ...themes, [id]: entry } },
                  "Palette saved.",
                );
                setPalette(id);
                setTheme(null);
                setError("");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <ErrorBox>{error}</ErrorBox>
            <Field label="Palette name">
              <input
                required
                autoFocus
                value={theme.name}
                onChange={(e) => setTheme({ ...theme, name: e.target.value })}
              />
            </Field>
            <div className="three">
              {["primary", "accent", "background"].map((k) => (
                <Field key={k} label={k}>
                  <input
                    type="color"
                    value={theme[k]}
                    onChange={(e) =>
                      setTheme({ ...theme, [k]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
            <div
              className="gradientPreview"
              style={{
                background: `linear-gradient(90deg, ${theme.primary},${theme.accent})`,
              }}
            />
            <p className="footnote">
              Primary and accent define the gradient endpoints and the
              representative effect colours. Existing per-effect mappings are
              retained.
            </p>
            <div className="dialogActions">
              <button type="button" onClick={() => setTheme(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save palette
              </button>
            </div>
          </form>
        </Modal>
      )}
      {group && (
        <Modal title="Light group" onClose={() => setGroup(null)} busy={busy}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (!group.name.trim() || !group.lightIds.length)
                  throw Error(
                    "Enter a group name and select at least one light.",
                  );
                await save(
                  {
                    ...w,
                    groups: w.groups.some((g) => g.id === group.id)
                      ? w.groups.map((g) => (g.id === group.id ? group : g))
                      : [...w.groups, group],
                  },
                  "Group saved.",
                );
                setGroup(null);
                setError("");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <ErrorBox>{error}</ErrorBox>
            <Field label="Group name">
              <input
                autoFocus
                required
                value={group.name}
                onChange={(e) => setGroup({ ...group, name: e.target.value })}
              />
            </Field>
            {w.lights.map((l) => (
              <label className="check" key={l.id}>
                <input
                  type="checkbox"
                  checked={group.lightIds.includes(l.id)}
                  onChange={(e) =>
                    setGroup({
                      ...group,
                      lightIds: e.target.checked
                        ? [...group.lightIds, l.id]
                        : group.lightIds.filter((id) => id !== l.id),
                    })
                  }
                />
                {l.name}
              </label>
            ))}
            <div className="dialogActions">
              {w.groups.some((g) => g.id === group.id) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await save(
                        {
                          ...w,
                          groups: w.groups.filter((g) => g.id !== group.id),
                        },
                        "Group removed. Lights preserved.",
                      );
                      setGroup(null);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Delete group
                </button>
              )}
              <button type="button" onClick={() => setGroup(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save group
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
