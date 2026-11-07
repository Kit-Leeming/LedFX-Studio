import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Group, Line, Rect, Text, Circle } from "react-konva";
import { Plus, Minus, Maximize, Lock, Unlock } from "lucide-react";
import { Field, Modal, ErrorBox, Empty } from "./components";
import { stripPoints, placementError, validateWorkspace } from "./domain";
export function Canvas({
  workspace: w,
  selected,
  setSelected,
  save,
  busy,
  readOnly = false,
  colors = {},
}) {
  const wrap = useRef(),
    [width, setWidth] = useState(800),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [panMode, setPanMode] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const o = new ResizeObserver(([e]) =>
      setWidth(Math.floor(e.contentRect.width)),
    );
    o.observe(wrap.current);
    return () => o.disconnect();
  }, []);
  const margin = 35,
    base = Math.max(
      0.1,
      Math.min((width - margin * 2) / w.stage.width, 460 / w.stage.height),
    ),
    scale = base * zoom,
    height = Math.max(260, Math.min(560, w.stage.height * base + margin * 2));
  function choose(id, shift) {
    setSelected((prev) =>
      shift
        ? prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
        : [id],
    );
  }
  return (
    <>
      <div className="canvasToolbar">
        <span>
          {readOnly
            ? "Select lights · layout locked"
            : "Front view · physical dimensions locked"}
        </span>
        <div className="actions">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(0.25, zoom / 1.25))}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(4, zoom * 1.25))}
          >
            <Plus size={15} />
          </button>
          <button
            aria-label="Fit stage"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize size={15} />
          </button>
          <button aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>
            Pan
          </button>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div
        className={`stageCanvas ${panMode ? "panning" : ""}`}
        ref={wrap}
        role="img"
        aria-label={`Front-facing stage, ${w.stage.width} by ${w.stage.height} metres. Use the light list to select and numeric controls to position lights.`}
      >
        <Stage
          width={width}
          height={height}
          draggable={panMode}
          x={pan.x}
          y={pan.y}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage())
              setPan({ x: e.target.x(), y: e.target.y() });
          }}
        >
          <Layer x={margin} y={margin} scaleX={scale} scaleY={scale}>
            <Rect
              x={0}
              y={0}
              width={w.stage.width}
              height={w.stage.height}
              stroke="#71818b"
              strokeWidth={1 / scale}
              fill="#121e25"
            />
            {Array.from(
              { length: Math.floor(w.stage.width * 2) + 1 },
              (_, i) => (
                <Group key={"x" + i}>
                  <Line
                    points={[i / 2, 0, i / 2, w.stage.height]}
                    stroke="#33444e"
                    strokeWidth={0.5 / scale}
                  />
                  {i % 2 === 0 && (
                    <Text
                      x={i / 2}
                      y={-0.22}
                      text={`${i / 2}m`}
                      fill="#b6c8d2"
                      fontSize={11 / scale}
                    />
                  )}
                </Group>
              ),
            )}
            {Array.from(
              { length: Math.floor(w.stage.height * 2) + 1 },
              (_, i) => (
                <Group key={"y" + i}>
                  <Line
                    points={[0, i / 2, w.stage.width, i / 2]}
                    stroke="#33444e"
                    strokeWidth={0.5 / scale}
                  />
                  {i % 2 === 0 && (
                    <Text
                      x={-0.32}
                      y={i / 2}
                      text={`${i / 2}`}
                      fill="#b6c8d2"
                      fontSize={10 / scale}
                    />
                  )}
                </Group>
              ),
            )}
            {w.placements.map((p) => {
              const l = w.lights.find((l) => l.id === p.lightId);
              if (!l) return null;
              const color = colors[l.id] || "#7ee6ca",
                active = selected.includes(l.id);
              return (
                <Group
                  key={l.id}
                  x={p.x}
                  y={p.y}
                  draggable={!readOnly && !p.locked && !panMode && !busy}
                  onClick={(e) => {
                    if (!panMode)
                      choose(
                        l.id,
                        e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey,
                      );
                  }}
                  onTap={() => choose(l.id, false)}
                  onDragEnd={async (e) => {
                    e.cancelBubble = true;
                    const next = {
                      ...p,
                      x: Math.round(e.target.x() * 100) / 100,
                      y: Math.round(e.target.y() * 100) / 100,
                    };
                    e.target.position({ x: p.x, y: p.y });
                    const err = placementError(w, l, next);
                    if (err) {
                      setError(err);
                      return;
                    }
                    try {
                      await save(
                        {
                          ...w,
                          placements: w.placements.map((x) =>
                            x.lightId === l.id ? next : x,
                          ),
                        },
                        `${l.name} moved.`,
                      );
                      setError("");
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                >
                  <Group rotation={p.rotation}>
                    {l.kind === "strip" ? (
                      <>
                        <Line
                          points={stripPoints(l.length, p.bend)}
                          stroke={color}
                          opacity={0.15}
                          strokeWidth={14 / scale}
                          lineCap="round"
                        />
                        <Line
                          points={stripPoints(l.length, p.bend)}
                          stroke={active ? "#fff" : color}
                          strokeWidth={(active ? 4 : 3) / scale}
                          hitStrokeWidth={18 / scale}
                          lineCap="round"
                        />
                        <Circle radius={4 / scale} fill={color} />
                      </>
                    ) : (
                      <>
                        <Rect
                          width={l.width}
                          height={l.height}
                          fill={color}
                          opacity={0.15}
                          stroke={active ? "#fff" : color}
                          strokeWidth={2 / scale}
                        />
                        {l.kind === "matrix" &&
                          Array.from(
                            { length: Math.min(l.columns, 24) },
                            (_, i) =>
                              Array.from(
                                { length: Math.min(l.rows, 24) },
                                (_, j) => (
                                  <Circle
                                    key={`${i}-${j}`}
                                    x={
                                      ((i + 0.5) * l.width) /
                                      Math.min(l.columns, 24)
                                    }
                                    y={
                                      ((j + 0.5) * l.height) /
                                      Math.min(l.rows, 24)
                                    }
                                    radius={
                                      Math.min(
                                        l.width / Math.min(l.columns, 24),
                                        l.height / Math.min(l.rows, 24),
                                      ) * 0.13
                                    }
                                    fill={color}
                                  />
                                ),
                              ),
                          )}
                        {l.kind === "point" && (
                          <Circle
                            x={l.width / 2}
                            y={l.height / 2}
                            radius={Math.min(l.width, l.height) * 0.25}
                            fill={color}
                          />
                        )}
                      </>
                    )}
                  </Group>
                  <Text
                    text={l.name + (p.locked ? " · locked" : "")}
                    y={-20 / scale}
                    fill={active ? "#fff" : "#b6c8d2"}
                    fontSize={12 / scale}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
      <p className="footnote">
        {readOnly
          ? "Click to select. Shift / Ctrl-click adds or removes lights."
          : "Drag to move. Use coordinates for precise placement. Strip length and matrix size are set in Devices."}
      </p>
    </>
  );
}
function PositionForm({ w, l, p, save, busy }) {
  const [draft, setDraft] = useState(p),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const err = placementError(w, l, draft);
        if (err) {
          setError(err);
          return;
        }
        try {
          await save(
            {
              ...w,
              placements: w.placements.map((x) =>
                x.lightId === l.id ? draft : x,
              ),
            },
            "Stage placement saved.",
          );
          setError("");
        } catch (e) {
          setError(e.message);
        }
      }}
    >
      <h2>{l.name}</h2>
      <p>
        {l.kind === "strip"
          ? `${l.length} m strip`
          : `${l.width} × ${l.height} m ${l.kind}`}
      </p>
      <ErrorBox>{error}</ErrorBox>
      <div className="two">
        {[
          ["x", "X position (m)"],
          ["y", "Y position (m)"],
          ["rotation", "Rotation (°)"],
        ].map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              required
              type="number"
              step="any"
              value={draft[k]}
              disabled={p.locked}
              onChange={(e) =>
                setDraft({ ...draft, [k]: Number(e.target.value) })
              }
            />
          </Field>
        ))}
      </div>
      {l.kind === "strip" && (
        <Field
          label="Strip bend (°)"
          hint="0° is straight. Bending preserves the configured physical length."
        >
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={draft.bend}
            disabled={p.locked}
            onChange={(e) =>
              setDraft({ ...draft, bend: Number(e.target.value) })
            }
          />
        </Field>
      )}
      <div className="actions">
        <button className="primary" disabled={busy || p.locked}>
          Save position
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            save(
              {
                ...w,
                placements: w.placements.map((x) =>
                  x.lightId === l.id ? { ...p, locked: !p.locked } : x,
                ),
              },
              p.locked ? "Placement unlocked." : "Placement locked.",
            ).catch((e) => setError(e.message))
          }
        >
          {p.locked ? <Unlock size={14} /> : <Lock size={14} />}{" "}
          {p.locked ? "Unlock" : "Lock"}
        </button>
      </div>
      <button
        type="button"
        className="textButton"
        disabled={busy}
        onClick={() =>
          save(
            {
              ...w,
              placements: w.placements.filter((x) => x.lightId !== l.id),
            },
            "Removed from Stage. The light remains in Devices.",
          ).catch((e) => setError(e.message))
        }
      >
        Remove from stage
      </button>
    </form>
  );
}
export default function StageView({
  workspace: w,
  selected,
  setSelected,
  save,
  busy,
}) {
  const [placeId, setPlaceId] = useState(""),
    [error, setError] = useState(""),
    [settings, setSettings] = useState(null);
  const light = w.lights.find((l) => l.id === selected[0]),
    p = w.placements.find((p) => p.lightId === light?.id),
    unplaced = w.lights.filter(
      (l) => !w.placements.some((p) => p.lightId === l.id),
    );
  return (
    <>
      <div className="pageHead">
        <div>
          <h1>Stage</h1>
          <p>
            Place lights as seen by your audience. Physical size stays
            consistent.
          </p>
        </div>
        <button
          onClick={() => {
            setSettings({ ...w.stage });
            setError("");
          }}
        >
          Stage dimensions
        </button>
      </div>
      <div className="stageLayout">
        <section className="panel canvasPanel">
          <Canvas
            workspace={w}
            selected={selected}
            setSelected={setSelected}
            save={save}
            busy={busy}
          />
        </section>
        <aside className="panel positionPanel">
          <h2>Lights on stage</h2>
          <div className="compactList">
            {w.placements.map((p) => {
              const l = w.lights.find((l) => l.id === p.lightId);
              return (
                <button
                  key={l.id}
                  aria-pressed={selected.includes(l.id)}
                  onClick={() => setSelected([l.id])}
                >
                  {l.name}
                  {p.locked && <Lock size={12} />}
                </button>
              );
            })}
          </div>
          {!w.placements.length && (
            <p className="footnote">Choose a light below to place it.</p>
          )}
          {unplaced.length > 0 && (
            <form
              className="placeForm"
              onSubmit={async (e) => {
                e.preventDefault();
                const l = w.lights.find((l) => l.id === placeId);
                if (!l) return;
                const p = {
                  lightId: l.id,
                  x: 0.25,
                  y: 0.5,
                  rotation: 0,
                  bend: 0,
                  locked: false,
                };
                const err = placementError(w, l, p);
                if (err) {
                  setError(err);
                  return;
                }
                try {
                  await save(
                    { ...w, placements: [...w.placements, p] },
                    `${l.name} placed on Stage.`,
                  );
                  setSelected([l.id]);
                  setPlaceId("");
                  setError("");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Field label="Light to place">
                <select
                  required
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                >
                  <option value="">Choose a light</option>
                  {unplaced.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button disabled={busy || !placeId}>Place on stage</button>
            </form>
          )}
          <ErrorBox>{error}</ErrorBox>
          {light && p ? (
            <PositionForm
              key={JSON.stringify(p)}
              w={w}
              l={light}
              p={p}
              save={save}
              busy={busy}
            />
          ) : (
            w.placements.length > 0 && (
              <p className="footnote">
                Select a placed light to edit its position.
              </p>
            )
          )}
        </aside>
      </div>
      {settings && (
        <Modal
          title="Stage dimensions"
          onClose={() => setSettings(null)}
          busy={busy}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const next = { ...w, stage: settings };
                validateWorkspace(next);
                await save(
                  next,
                  "Stage dimensions saved. Light sizes and positions are unchanged.",
                );
                setSettings(null);
                setError("");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <ErrorBox>{error}</ErrorBox>
            <div className="two">
              {["width", "height"].map((k) => (
                <Field key={k} label={`Stage ${k} (m)`}>
                  <input
                    required
                    type="number"
                    min={0.1}
                    max={100}
                    step="any"
                    value={settings[k]}
                    onChange={(e) =>
                      setSettings({ ...settings, [k]: Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="dialogActions">
              <button type="button" onClick={() => setSettings(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save dimensions
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
