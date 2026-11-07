import React, { useState } from "react";
import { Plus, Edit2, Trash2, Lightbulb, Cpu } from "lucide-react";
import { Field, Modal, Empty, ErrorBox } from "./components";
import {
  uid,
  count,
  lightError,
  validateWorkspace,
  removeLight,
} from "./domain";
const freshLight = () => ({
  id: uid(),
  name: "",
  kind: "strip",
  connection: "standalone",
  channelType: "RGB",
  pixels: 60,
  columns: 16,
  rows: 16,
  length: 1,
  width: 1,
  height: 1,
  voltage: 12,
  protocol: "",
  endpoint: "",
  model: "",
  virtualId: "",
});
const freshOutput = () => ({
  id: uid(),
  name: "",
  voltage: 12,
  protocol: "",
  channelType: "RGB",
  capacity: 300,
});
export default function Devices({
  workspace: w,
  save,
  busy,
  virtuals,
  devices,
}) {
  const [tab, setTab] = useState("lights"),
    [draft, setDraft] = useState(null),
    [kind, setKind] = useState(""),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(null);
  function open(type, value) {
    setKind(type);
    setDraft(
      structuredClone(
        value ||
          (type === "light"
            ? freshLight()
            : {
                id: uid(),
                name: "",
                address: "",
                outputs: [{ ...freshOutput(), name: "Output 1" }],
              }),
      ),
    );
    setError("");
  }
  const change = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const available = Object.entries(virtuals).filter(
    ([id, v]) =>
      v.is_device &&
      v.pixel_count > 0 &&
      !w.lights.some((l) => l.virtualId === id),
  );
  function useOutput(id, v) {
    const d = devices[v.is_device],
      rows = Number(v.config?.rows) || 1,
      pixels = v.pixel_count,
      matrix = rows > 1 && pixels % rows === 0;
    open("light", {
      ...freshLight(),
      name: v.config?.name || id,
      kind: pixels === 1 ? "point" : matrix ? "matrix" : "strip",
      connection: "integrated",
      virtualId: id,
      pixels,
      rows: matrix ? rows : 16,
      columns: matrix ? pixels / rows : 16,
      width: pixels === 1 ? 0.2 : 1,
      height: pixels === 1 ? 0.2 : 1,
      endpoint: d?.config?.ip_address || "",
      model: d?.type || "",
      channelType: d?.config?.rgbw_led ? "RGBW" : "RGB",
    });
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (kind === "light") {
        if (
          draft.connection === "integrated" &&
          !virtuals[draft.virtualId]?.is_device
        )
          throw Error(
            "Choose an existing LedFX output for a built-in-controller light. Unsupported lights cannot be registered.",
          );
        const err = lightError(draft);
        if (err) throw Error(err);
        if (
          draft.virtualId &&
          w.lights.some(
            (l) => l.id !== draft.id && l.virtualId === draft.virtualId,
          )
        )
          throw Error(
            "This LedFX output is already assigned to another light.",
          );
        const v = virtuals[draft.virtualId];
        if (
          v &&
          draft.kind === "matrix" &&
          Number(v.config?.rows || 1) !== draft.rows
        )
          throw Error(
            `The LedFX virtual uses ${v.config?.rows || 1} row(s). Match its matrix rows in classic LedFX before linking it.`,
          );
        if (v && v.pixel_count !== count(draft))
          throw Error(
            `LedFX output has ${v.pixel_count} pixels; this light has ${count(draft)}. Correct the device definition before linking it.`,
          );
      }
      const collection = kind === "light" ? "lights" : "controllers";
      let next = {
        ...w,
        [collection]: w[collection].some((x) => x.id === draft.id)
          ? w[collection].map((x) => (x.id === draft.id ? draft : x))
          : [...w[collection], draft],
      };
      if (kind === "light" && draft.connection === "integrated")
        next.patches = next.patches.filter((p) => p.lightId !== draft.id);
      validateWorkspace(next);
      await save(next, `${kind === "light" ? "Light" : "Controller"} saved.`);
      setDraft(null);
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove() {
    try {
      const next =
        deleting.type === "light"
          ? removeLight(w, deleting.id)
          : {
              ...w,
              controllers: w.controllers.filter((c) => c.id !== deleting.id),
              patches: w.patches.filter((p) => p.controllerId !== deleting.id),
            };
      await save(
        next,
        "Device removed from Studio. LedFX output was not changed.",
      );
      setDeleting(null);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <h1>Devices</h1>
          <p>
            Define your lights and controllers before connecting or arranging
            them.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => open(tab === "lights" ? "light" : "controller")}
        >
          <Plus size={16} /> Add {tab === "lights" ? "light" : "controller"}
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label="Device type">
        {["lights", "controllers"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "lights" ? "Lights" : "Controllers"}{" "}
            <span>{w[t].length}</span>
          </button>
        ))}
      </div>
      {tab === "lights" ? (
        <>
          {!w.lights.length ? (
            <Empty title="Start with a light">
              Add a strip, matrix or single-pixel light. A standalone light can
              be saved before you have a controller.
            </Empty>
          ) : (
            <div className="deviceGrid">
              {w.lights.map((l) => (
                <article className="deviceCard" key={l.id}>
                  <div className="cardTitle">
                    <Lightbulb size={20} />
                    <h2>{l.name}</h2>
                    <span className="tag">
                      {l.kind === "point"
                        ? "Single pixel"
                        : l.kind === "matrix"
                          ? "Matrix"
                          : "Strip"}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Physical size</dt>
                      <dd>
                        {l.kind === "strip"
                          ? `${l.length} m long`
                          : `${l.width} × ${l.height} m`}
                      </dd>
                    </div>
                    <div>
                      <dt>Pixels</dt>
                      <dd>
                        {l.kind === "matrix"
                          ? `${l.columns} × ${l.rows} · `
                          : ""}
                        {count(l)} · {l.channelType}
                      </dd>
                    </div>
                    <div>
                      <dt>Connection</dt>
                      <dd>
                        {l.connection === "integrated"
                          ? "Built-in controller"
                          : w.patches.some((p) => p.lightId === l.id)
                            ? "Patched to controller"
                            : "Standalone · not patched"}
                      </dd>
                    </div>
                    <div>
                      <dt>LedFX output</dt>
                      <dd>
                        {l.virtualId && virtuals[l.virtualId]
                          ? virtuals[l.virtualId].config?.name || l.virtualId
                          : "Control not configured"}
                      </dd>
                    </div>
                  </dl>
                  <div className="cardActions">
                    <button onClick={() => open("light", l)}>
                      <Edit2 size={14} /> Edit light
                    </button>
                    <button
                      aria-label={`Delete ${l.name}`}
                      onClick={() => {
                        setDeleting({ id: l.id, name: l.name, type: "light" });
                        setError("");
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {available.length > 0 && (
            <section className="panel availableOutputs">
              <h2>Existing LedFX outputs</h2>
              <p>
                Use an output you already control, then enter the light’s
                measured dimensions.
              </p>
              <div className="rowList">
                {available.map(([id, v]) => (
                  <div className="existingOutput" key={id}>
                    <span>
                      <strong>{v.config?.name || id}</strong>
                      <small>{v.pixel_count} pixels</small>
                    </span>
                    <button onClick={() => useOutput(id, v)}>Use output</button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {!w.controllers.length ? (
            <Empty title="Controllers are independent of lights">
              Create a named controller and describe its outputs. Lights with a
              built-in controller are managed in Lights.
            </Empty>
          ) : (
            <div className="deviceGrid">
              {w.controllers.map((c) => (
                <article className="deviceCard" key={c.id}>
                  <div className="cardTitle">
                    <Cpu size={20} />
                    <h2>{c.name}</h2>
                  </div>
                  <p>{c.address || "No network address recorded"}</p>
                  <ul className="outputList">
                    {c.outputs.map((o) => (
                      <li key={o.id}>
                        <strong>{o.name}</strong>
                        <span>
                          {o.voltage} V · {o.protocol} · {o.capacity} px ·{" "}
                          {o.channelType}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="cardActions">
                    <button onClick={() => open("controller", c)}>
                      <Edit2 size={14} /> Edit controller
                    </button>
                    <button
                      aria-label={`Delete ${c.name}`}
                      onClick={() => {
                        setDeleting({
                          id: c.id,
                          name: c.name,
                          type: "controller",
                        });
                        setError("");
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="footnote">
            These are Studio hardware definitions. Saving them does not change
            firmware, GPIO pins or electrical settings.
          </p>
        </>
      )}
      {draft && (
        <Modal
          title={kind === "light" ? "Light setup" : "Controller setup"}
          busy={busy}
          onClose={() => setDraft(null)}
        >
          <form onSubmit={submit}>
            <ErrorBox>{error}</ErrorBox>
            <Field label={kind === "light" ? "Light name" : "Controller name"}>
              <input
                required
                autoFocus
                maxLength={100}
                value={draft.name}
                onChange={(e) => change("name", e.target.value)}
              />
            </Field>
            {kind === "light" ? (
              <>
                <div className="two">
                  <Field label="Light type">
                    <select
                      value={draft.kind}
                      onChange={(e) => change("kind", e.target.value)}
                    >
                      <option value="point">Single pixel · wash / spot</option>
                      <option value="strip">LED strip</option>
                      <option value="matrix">LED matrix / curtain</option>
                    </select>
                  </Field>
                  <Field label="Controller arrangement">
                    <select
                      value={draft.connection}
                      onChange={(e) => change("connection", e.target.value)}
                    >
                      <option value="standalone">Standalone light</option>
                      <option value="integrated">
                        Light with built-in controller
                      </option>
                    </select>
                  </Field>
                </div>
                <div className="two">
                  <Field label="Channel layout">
                    <select
                      value={draft.channelType}
                      onChange={(e) => change("channelType", e.target.value)}
                    >
                      <option>RGB</option>
                      <option>RGBW</option>
                      <option value="RGBUV">RGB + UV</option>
                    </select>
                  </Field>
                  {draft.kind === "strip" && (
                    <Field label="Pixel count">
                      <input
                        required
                        type="number"
                        min={1}
                        max={100000}
                        value={draft.pixels}
                        onChange={(e) =>
                          change("pixels", Number(e.target.value))
                        }
                      />
                    </Field>
                  )}
                </div>
                {draft.kind === "matrix" && (
                  <div className="two">
                    <Field label="Pixel columns">
                      <input
                        required
                        type="number"
                        min={1}
                        step={1}
                        value={draft.columns}
                        onChange={(e) =>
                          change("columns", Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Pixel rows">
                      <input
                        required
                        type="number"
                        min={1}
                        step={1}
                        value={draft.rows}
                        onChange={(e) => change("rows", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                )}
                {draft.kind === "strip" ? (
                  <Field label="Physical strip length (m)">
                    <input
                      required
                      type="number"
                      min={0.01}
                      max={100}
                      step="any"
                      value={draft.length}
                      onChange={(e) => change("length", Number(e.target.value))}
                    />
                  </Field>
                ) : (
                  <div className="two">
                    <Field label="Physical width (m)">
                      <input
                        required
                        type="number"
                        min={0.01}
                        max={100}
                        step="any"
                        value={draft.width}
                        onChange={(e) =>
                          change("width", Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Physical height (m)">
                      <input
                        required
                        type="number"
                        min={0.01}
                        max={100}
                        step="any"
                        value={draft.height}
                        onChange={(e) =>
                          change("height", Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>
                )}
                {draft.connection === "standalone" ? (
                  <div className="two">
                    <Field label="Rated voltage">
                      <select
                        value={draft.voltage}
                        onChange={(e) =>
                          change("voltage", Number(e.target.value))
                        }
                      >
                        {[5, 12, 24].map((v) => (
                          <option key={v} value={v}>
                            {v} V
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Chipset / output protocol"
                      hint="Use the exact hardware type, e.g. SM16703 or PWM."
                    >
                      <input
                        required
                        value={draft.protocol}
                        onChange={(e) => change("protocol", e.target.value)}
                      />
                    </Field>
                  </div>
                ) : (
                  <>
                    <div className="two">
                      <Field label="Brand / model (optional)">
                        <input
                          placeholder="e.g. Twinkly curtain"
                          value={draft.model}
                          onChange={(e) => change("model", e.target.value)}
                        />
                      </Field>
                      <Field label="Network address (optional)">
                        <input
                          value={draft.endpoint}
                          onChange={(e) => change("endpoint", e.target.value)}
                        />
                      </Field>
                    </div>
                    <p className="inlineNote">
                      This light does not need a patch. Choose a configured
                      LedFX output below. The current engine supports Twinkly
                      Squares; curtain support has not been established.
                    </p>
                  </>
                )}
                <section className="outputConnection">
                  <h3>LedFX output connection</h3>
                  <Field
                    label="Existing LedFX virtual"
                    hint={
                      draft.connection === "integrated"
                        ? "Required for built-in-controller lights. Only configured LedFX outputs are supported."
                        : "Optional for a standalone light until its output has been configured in LedFX."
                    }
                  >
                    <select
                      required={draft.connection === "integrated"}
                      value={draft.virtualId}
                      onChange={(e) => change("virtualId", e.target.value)}
                    >
                      <option value="">Not configured</option>
                      {Object.entries(virtuals)
                        .filter(
                          ([, v]) =>
                            draft.connection !== "integrated" || v.is_device,
                        )
                        .map(([id, v]) => (
                          <option key={id} value={id}>
                            {v.config?.name || id} · {v.pixel_count} pixels
                          </option>
                        ))}
                    </select>
                  </Field>
                </section>
              </>
            ) : (
              <>
                <Field label="Network address (optional)">
                  <input
                    value={draft.address}
                    onChange={(e) => change("address", e.target.value)}
                  />
                </Field>
                <h3>Outputs</h3>
                {draft.outputs.map((o, i) => (
                  <fieldset className="outputEditor" key={o.id}>
                    <legend>Output {i + 1}</legend>
                    <Field label={`Output ${i + 1} name`}>
                      <input
                        required
                        value={o.name}
                        onChange={(e) =>
                          change(
                            "outputs",
                            draft.outputs.map((x) =>
                              x.id === o.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </Field>
                    <div className="two">
                      {[
                        ["voltage", "Voltage"],
                        ["capacity", "Pixel capacity"],
                        ["protocol", "Chipset / output protocol"],
                        ["channelType", "Channel layout"],
                      ].map(([key, label]) => (
                        <Field key={key} label={`Output ${i + 1} ${label}`}>
                          {["voltage", "channelType"].includes(key) ? (
                            <select
                              value={o[key]}
                              onChange={(e) =>
                                change(
                                  "outputs",
                                  draft.outputs.map((x) =>
                                    x.id === o.id
                                      ? {
                                          ...x,
                                          [key]:
                                            key === "voltage"
                                              ? Number(e.target.value)
                                              : e.target.value,
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              {(key === "voltage"
                                ? [5, 12, 24]
                                : ["RGB", "RGBW", "RGBUV"]
                              ).map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              required
                              type={key === "capacity" ? "number" : "text"}
                              min={1}
                              value={o[key]}
                              onChange={(e) =>
                                change(
                                  "outputs",
                                  draft.outputs.map((x) =>
                                    x.id === o.id
                                      ? {
                                          ...x,
                                          [key]:
                                            key === "capacity"
                                              ? Number(e.target.value)
                                              : e.target.value,
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={draft.outputs.length === 1}
                      onClick={() =>
                        change(
                          "outputs",
                          draft.outputs.filter((x) => x.id !== o.id),
                        )
                      }
                    >
                      Remove output
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    change("outputs", [
                      ...draft.outputs,
                      {
                        ...freshOutput(),
                        name: `Output ${draft.outputs.length + 1}`,
                      },
                    ])
                  }
                >
                  <Plus size={14} /> Add output
                </button>
              </>
            )}
            <div className="dialogActions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy} type="submit">
                {busy
                  ? "Saving…"
                  : "Save " + (kind === "light" ? "light" : "controller")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={`Remove ${deleting.name}?`}
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <ErrorBox>{error}</ErrorBox>
          <p>
            {deleting.type === "light"
              ? "Its stage placement, group membership and patch will be removed."
              : "Its patches will be removed. The lights will remain in Devices and on Stage."}{" "}
            This does not turn off or delete any LedFX output. You can undo this
            change.
          </p>
          <div className="dialogActions">
            <button disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button className="danger" disabled={busy} onClick={remove}>
              Remove {deleting.type}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
