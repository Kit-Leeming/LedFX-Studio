import React, { useState } from "react";
import { Field, Empty, ErrorBox } from "./components";
import { patchError, count } from "./domain";
export default function Patches({ workspace: w, save, busy }) {
  const [id, setId] = useState(""),
    [controllerId, setController] = useState(""),
    [outputId, setOutput] = useState(""),
    [start, setStart] = useState(1),
    [reversed, setReversed] = useState(false),
    [error, setError] = useState("");
  const lights = w.lights.filter((l) => l.connection === "standalone"),
    l = lights.find((l) => l.id === id),
    c = w.controllers.find((c) => c.id === controllerId);
  function select(light) {
    setId(light.id);
    const p = w.patches.find((p) => p.lightId === light.id);
    setController(p?.controllerId || "");
    setOutput(p?.outputId || "");
    setStart((p?.start ?? 0) + 1);
    setReversed(p?.reversed || false);
    setError("");
  }
  async function apply(e) {
    e.preventDefault();
    const p = {
      lightId: id,
      controllerId,
      outputId,
      start: Number(start) - 1,
      reversed,
    };
    const message = patchError(w, p);
    if (message) {
      setError(message);
      return;
    }
    try {
      await save(
        { ...w, patches: [...w.patches.filter((x) => x.lightId !== id), p] },
        "Patch saved. Physical controller settings were not changed.",
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <h1>Patches</h1>
          <p>Assign standalone lights to physical controller outputs.</p>
        </div>
      </div>
      <p className="inlineNote">
        Lights with built-in controllers bypass this section. Patch records
        describe your wiring; they do not provision controller firmware.
      </p>
      {!lights.length ? (
        <Empty title="No standalone lights to patch">
          Add a standalone light in Devices. Your built-in-controller lights are
          already available for Stage.
        </Empty>
      ) : (
        <div className="split">
          <section className="panel">
            <h2>Standalone lights</h2>
            <div className="rowList">
              {lights.map((light) => {
                const p = w.patches.find((p) => p.lightId === light.id),
                  controller = w.controllers.find(
                    (c) => c.id === p?.controllerId,
                  ),
                  output = controller?.outputs.find(
                    (o) => o.id === p?.outputId,
                  );
                return (
                  <button
                    key={light.id}
                    className={`selectRow ${id === light.id ? "selected" : ""}`}
                    onClick={() => select(light)}
                  >
                    <span>
                      <strong>{light.name}</strong>
                      <small>
                        {count(light)} pixels · {light.voltage} V ·{" "}
                        {light.protocol}
                      </small>
                    </span>
                    <span>
                      {p
                        ? `${controller.name} / ${output.name}`
                        : "Not patched"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="panel">
            {!l ? (
              <Empty title="Choose a light">
                Select a standalone light to view or change its patch.
              </Empty>
            ) : (
              <form onSubmit={apply}>
                <h2>{l.name}</h2>
                <ErrorBox>{error}</ErrorBox>
                <Field label="Controller">
                  <select
                    required
                    value={controllerId}
                    onChange={(e) => {
                      setController(e.target.value);
                      setOutput("");
                    }}
                  >
                    <option value="">Choose a controller</option>
                    {w.controllers.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Output">
                  <select
                    required
                    value={outputId}
                    onChange={(e) => setOutput(e.target.value)}
                  >
                    <option value="">Choose an output</option>
                    {c?.outputs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} · {o.voltage} V · {o.protocol} · {o.capacity}{" "}
                        pixels
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Start pixel (1-based)"
                  hint={`Range: ${start}–${Number(start) + count(l) - 1}`}
                >
                  <input
                    required
                    type="number"
                    min={1}
                    step={1}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </Field>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={reversed}
                    onChange={(e) => setReversed(e.target.checked)}
                  />{" "}
                  Reverse physical pixel direction
                </label>
                <div className="actions">
                  <button className="primary" disabled={busy}>
                    Save patch
                  </button>
                  <button
                    type="button"
                    disabled={busy || !w.patches.some((p) => p.lightId === id)}
                    onClick={async () => {
                      try {
                        await save(
                          {
                            ...w,
                            patches: w.patches.filter((p) => p.lightId !== id),
                          },
                          "Light unpatched. Its stage position is preserved.",
                        );
                        setError("");
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Unpatch
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
