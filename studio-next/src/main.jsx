import React, { useState, useEffect, useRef, useId } from "react";
import { createRoot } from "react-dom/client";
import { Stage, Layer, Line, Circle, Rect, Text, Group } from "react-konva";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
} from "@xyflow/react";
import {
  Layers,
  Network,
  Library,
  Undo2,
  Plus,
  ArrowRight,
  Radio,
  Download,
  Upload,
  Check,
  Move,
  RotateCcw,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./style.css";
import {
  initial,
  palettes,
  validateConnection,
  patch,
  setPalette,
  snapshotRig,
  loadRig,
  parseProject,
  uid,
} from "./model";

const KEY = "ledfx-studio-design-prototype-v2";
function read() {
  try {
    return parseProject(localStorage.getItem(KEY) || JSON.stringify(initial()));
  } catch {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(KEY + "-recovery", raw);
    } catch {}
    return initial();
  }
}
function Field({ label, children }) {
  const id = useId();
  let assigned = false;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, (child) => {
        if (
          !assigned &&
          React.isValidElement(child) &&
          ["input", "select", "textarea"].includes(child.type)
        ) {
          assigned = true;
          return React.cloneElement(child, { id });
        }
        return child;
      })}
    </div>
  );
}
function Node({ data }) {
  return (
    <div className="patchNode">
      <strong>{data.label}</strong>
      <small>{data.detail}</small>
      {data.port ? (
        <Handle type="source" position={Position.Right} />
      ) : (
        <Handle type="target" position={Position.Left} />
      )}
    </div>
  );
}
const nodeTypes = { port: Node };
function App() {
  const [s, setS] = useState(read),
    [history, setHistory] = useState([]),
    [view, setView] = useState(location.hash.slice(1) || "stage"),
    [selected, setSelected] = useState(["f1"]),
    [tool, setTool] = useState("select"),
    [status, setStatus] = useState(
      "Demo project loaded. No hardware connected.",
    ),
    [error, setError] = useState(() => {
      try {
        return localStorage.getItem(KEY + "-recovery")
          ? "A saved project could not be read. Its original data is preserved. Export recovery data before replacing it."
          : "";
      } catch {
        return "";
      }
    }),
    [scope, setScope] = useState("global"),
    [search, setSearch] = useState(""),
    [found, setFound] = useState(false),
    [name, setName] = useState("Evening set"),
    [tab, setTab] = useState("Rigs"),
    [points, setPoints] = useState([]),
    [saveError, setSaveError] = useState(""),
    [effectChoice, setEffectChoice] = useState(""),
    [colourChoice, setColourChoice] = useState(""),
    [size, setSize] = useState({ w: 900, h: 550 });
  const wrap = useRef(),
    file = useRef(),
    drawing = useRef(false);
  const fixture = s.fixtures.find((f) => f.id === selected[0]),
    profile = s.profiles.find((p) => p.id === fixture?.profileId),
    geo = s.geometry.find((g) => g.fixtureId === fixture?.id),
    connection = s.connections.find((c) => c.fixtureId === fixture?.id);
  const [portChoice, setPortChoice] = useState("c1:p1"),
    [start, setStart] = useState(0),
    [profileChoice, setProfileChoice] = useState("rgb"),
    [fixtureName, setFixtureName] = useState("New strip");
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      setSaveError("");
    } catch {
      setSaveError(
        "Browser storage is full or unavailable. Export your project to keep your changes.",
      );
    }
  }, [s]);
  useEffect(() => {
    const fn = () => setView(location.hash.slice(1) || "stage");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!wrap.current) return;
    const r = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: 550 }),
    );
    r.observe(wrap.current);
    return () => r.disconnect();
  }, [view]);
  useEffect(() => {
    const k = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "z" &&
        !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
      ) {
        e.preventDefault();
        undo();
      }
      if (e.key === "Escape") {
        setTool("select");
        setPoints([]);
        drawing.current = false;
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [history]);
  function edit(next, message = "Project updated") {
    setHistory((h) => [...h.slice(-39), s]);
    setS(next);
    setError("");
    setStatus(message);
  }
  function undo() {
    if (!history.length) return;
    setS(history.at(-1));
    setHistory(history.slice(0, -1));
    setStatus("Last edit undone.");
    setError("");
  }
  function choose(id, multi = false) {
    setSelected((x) =>
      multi ? (x.includes(id) ? x.filter((a) => a !== id) : [...x, id]) : [id],
    );
  }
  function updateFixture(changes) {
    edit(
      {
        ...s,
        fixtures: s.fixtures.map((f) =>
          selected.includes(f.id) ? { ...f, ...changes } : f,
        ),
      },
      `Updated ${selected.length} fixture(s).`,
    );
  }
  function updateGeo(changes) {
    if (!geo) return;
    edit(
      {
        ...s,
        geometry: s.geometry.map((g) =>
          g.fixtureId === fixture.id ? { ...g, ...changes } : g,
        ),
      },
      "Stage position updated. Wiring unchanged.",
    );
  }
  function connect(c) {
    try {
      edit(
        patch(s, c),
        "Fixture patched in the demo. No hardware changes applied.",
      );
    } catch (e) {
      setError(e.message);
    }
  }
  function addFixture() {
    if (!fixtureName.trim()) {
      setError("Enter a fixture name.");
      return;
    }
    const p = s.profiles.find((p) => p.id === profileChoice),
      id = uid();
    edit(
      {
        ...s,
        fixtures: [
          ...s.fixtures,
          {
            id,
            name: fixtureName.trim(),
            profileId: p.id,
            effect: "Energy",
            paletteId: null,
            uv: 0,
          },
        ],
        geometry: [
          ...s.geometry,
          {
            fixtureId: id,
            x: 250,
            y: 160,
            kind: p.kind === "wash" ? "wash" : "straight",
            points: p.kind === "wash" ? [] : [0, 0, 160, 0],
          },
        ],
      },
      "Fixture created. Choose an output in Patch.",
    );
    setSelected([id]);
  }
  function finishPath(ps = points) {
    if (!fixture || profile?.kind !== "strip") {
      setError("Select a strip from the fixture list before drawing.");
      return;
    }
    if (ps.length < 4) {
      setError("Add at least two points.");
      return;
    }
    const ox = ps[0],
      oy = ps[1];
    updateGeo({
      x: ox,
      y: oy,
      kind:
        tool === "curve"
          ? "curve"
          : tool === "straight"
            ? "straight"
            : "freehand",
      points: ps.map((p, i) => p - (i % 2 ? oy : ox)),
    });
    setPoints([]);
    setTool("select");
  }
  function paletteColor(f) {
    return (
      palettes.find((p) => p.id === (f.paletteId || s.globalPalette))
        ?.colors[0] || "#79f2c0"
    );
  }
  function screenPoint(e) {
    const p = e.target.getStage().getPointerPosition();
    return [
      Math.max(0, Math.min(900, (p.x * 900) / size.w)),
      Math.max(0, Math.min(550, (p.y * 900) / size.w)),
    ];
  }
  const nodes = s.controllers
    .flatMap((c, i) =>
      c.ports.map((p, j) => ({
        id: `${c.id}:${p.id}`,
        type: "port",
        position: { x: 30, y: 30 + i * 220 + j * 90 },
        data: {
          label: `${c.name} · ${p.name}`,
          detail: `${p.voltage} V · ${p.protocol} · ${p.capacity} px${c.online ? "" : " · Offline"}`,
          port: true,
        },
      })),
    )
    .concat(
      s.fixtures.map((f, i) => ({
        id: f.id,
        type: "port",
        position: { x: 470, y: 30 + i * 110 },
        data: {
          label: f.name,
          detail: s.profiles.find((p) => p.id === f.profileId)?.name,
        },
      })),
    );
  const edges = s.connections.map((c) => ({
    id: c.id,
    source: `${c.controllerId}:${c.portId}`,
    target: c.fixtureId,
    label: `${c.start + 1}–${c.start + c.count}${c.reversed ? " · reversed" : ""}`,
    style: { stroke: "#79f2c0", strokeWidth: 2 },
  }));
  function edgeCandidate(c) {
    const [controllerId, portId] = (c.source || "").split(":");
    const f = s.fixtures.find((f) => f.id === c.target),
      p = s.profiles.find((p) => p.id === f?.profileId);
    return {
      controllerId,
      portId,
      fixtureId: c.target,
      start: Number(start),
      count: p?.pixels,
      reversed: false,
    };
  }
  function exportProject() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
    );
    a.download = "ledfx-studio-demo.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Demo project exported.");
  }
  async function importProject(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const next = parseProject(await f.text());
      edit(next, "Demo project imported. Undo restores the previous project.");
    } catch (e) {
      setError(e.message);
    }
    e.target.value = "";
  }
  const filtered = s.fixtures.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app">
      <a
        href="#workspace"
        className="skip"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("workspace").focus();
        }}
      >
        Skip to workspace
      </a>
      <header className="top">
        <div className="brand">
          <span className="brandmark">
            <Radio size={23} />
          </span>
          <strong>
            LedFX <span>STUDIO</span>
          </strong>
        </div>
        <div className="project">
          <span className="eyebrow">WORKSPACE</span>
          <strong>
            Modular stage <span className="demo">Simulation</span>
          </strong>
        </div>
        <div className="topActions">
          <span className="saved">
            <Check size={14} />{" "}
            {saveError ? "Export recommended" : "Saved in this browser"}
          </span>
          <button onClick={undo} disabled={!history.length}>
            <Undo2 size={16} /> Undo
          </button>
          <button onClick={exportProject}>
            <Download size={16} /> Export
          </button>
          <button
            aria-label="Import demo project"
            onClick={() => file.current.click()}
          >
            <Upload size={16} />
          </button>
          <input
            hidden
            ref={file}
            type="file"
            accept="application/json"
            onChange={importProject}
          />
        </div>
      </header>
      <div className="shell">
        <nav className="rail" aria-label="Main navigation">
          {[
            ["stage", "Stage", Layers],
            ["patch", "Patch", Network],
            ["library", "Library", Library],
          ].map(([id, label, Icon]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "active" : ""}
            >
              <Icon size={21} />
              {label}
            </a>
          ))}
          <div className="railBottom">
            PHASE 01
            <br />
            PROTOTYPE
          </div>
        </nav>
        <aside className="fixturePanel">
          <div className="panelHeading">
            <h2>Fixtures</h2>
            <span className="count">{s.fixtures.length}</span>
          </div>
          <label className="search">
            <span className="sr">Find a fixture</span>
            <input
              placeholder="Find a fixture…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            className="groupSelect"
            onClick={() => setSelected(s.fixtures.map((f) => f.id))}
          >
            Select all fixtures
          </button>
          {s.groups.map((g) => (
            <button
              key={g.id}
              className="groupSelect"
              onClick={() => setSelected(g.fixtureIds)}
            >
              ▸ {g.name} <span>{g.fixtureIds.length}</span>
            </button>
          ))}
          <div className="fixtureList">
            {filtered.map((f) => {
              const c = s.connections.find((c) => c.fixtureId === f.id),
                controller = s.controllers.find(
                  (x) => x.id === c?.controllerId,
                );
              return (
                <button
                  key={f.id}
                  className={`fixture ${selected.includes(f.id) ? "selected" : ""}`}
                  aria-pressed={selected.includes(f.id)}
                  onClick={(e) =>
                    choose(f.id, e.ctrlKey || e.metaKey || e.shiftKey)
                  }
                >
                  <span
                    className="fixtureGlyph"
                    style={{ color: paletteColor(f) }}
                  >
                    {s.profiles.find((p) => p.id === f.profileId)?.kind ===
                    "strip" ? (
                      <Layers size={18} />
                    ) : (
                      <Radio size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{f.name}</strong>
                    <small>
                      {!c
                        ? "Unpatched"
                        : controller?.online
                          ? "Patched · online"
                          : "Patched · offline"}
                    </small>
                  </span>
                  {selected.includes(f.id) && <Check size={14} />}
                </button>
              );
            })}
          </div>
          <p className="hint">
            Ctrl / Shift-click to select several.
            <br />
            Offline fixtures keep their position.
          </p>
          <details className="addFixture">
            <summary>
              <Plus size={15} /> Add fixture
            </summary>
            <Field label="Fixture name">
              <input
                value={fixtureName}
                onChange={(e) => setFixtureName(e.target.value)}
              />
            </Field>
            <Field label="Fixture profile">
              <select
                value={profileChoice}
                onChange={(e) => setProfileChoice(e.target.value)}
              >
                {s.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <button className="primary" onClick={addFixture}>
              Create fixture
            </button>
          </details>
          <button
            onClick={() => {
              if (!selected.length) return;
              edit(
                {
                  ...s,
                  groups: [
                    ...s.groups,
                    {
                      id: uid(),
                      name: `Group ${s.groups.length + 1}`,
                      fixtureIds: selected,
                    },
                  ],
                },
                "Selection saved as a group.",
              );
            }}
            disabled={!selected.length}
          >
            Group selection
          </button>
        </aside>
        <main id="workspace" tabIndex={-1}>
          <div className="workspaceHeading">
            <div>
              <span className="eyebrow">
                MODULAR STAGE / {view.toUpperCase()}
              </span>
              <h1>
                {view === "stage"
                  ? "Your stage, in view."
                  : view === "patch"
                    ? "Connect the pieces."
                    : "Build once. Play again."}
              </h1>
              <p>
                {view === "stage"
                  ? "Arrange fixtures from the audience’s perspective."
                  : view === "patch"
                    ? "Physical outputs and wiring, separate from stage positions."
                    : "Reusable profiles, rigs and independent looks."}
              </p>
            </div>
            <span className="modeBadge">No hardware output</span>
          </div>
          {(error || saveError) && (
            <div role="alert" className="error">
              {error || saveError}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {view === "stage" ? (
            <>
              <div className="toolbar">
                <div className="segmented">
                  {[
                    ["select", "Select"],
                    ["straight", "Straight"],
                    ["curve", "Curve"],
                    ["freehand", "Freehand"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={tool === id}
                      className={tool === id ? "active" : ""}
                      onClick={() => {
                        setTool(id);
                        setPoints([]);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="muted">Front elevation</span>
                <button
                  onClick={() =>
                    edit(
                      {
                        ...s,
                        decor: [
                          ...s.decor,
                          {
                            id: uid(),
                            name: "Speaker",
                            x: 100,
                            y: 400,
                          },
                        ],
                      },
                      "Stage decoration added.",
                    )
                  }
                >
                  <Plus size={14} /> Equipment
                </button>
              </div>
              <div className="stageWrap" ref={wrap}>
                <div className="canvasLabel">
                  STAGE FRONT <span>900 × 550 logical units</span>
                </div>
                <Stage
                  width={size.w}
                  height={(size.w * 550) / 900}
                  onMouseDown={(e) => {
                    if (tool === "select") return;
                    if (profile?.kind !== "strip") {
                      setError("Select a strip before drawing.");
                      return;
                    }
                    const p = screenPoint(e);
                    if (tool === "freehand") {
                      drawing.current = true;
                      setPoints(p);
                    } else setPoints((v) => [...v, ...p]);
                  }}
                  onMouseMove={(e) => {
                    if (drawing.current && tool === "freehand") {
                      const p = screenPoint(e);
                      setPoints((v) => [...v, ...p]);
                    }
                  }}
                  onMouseUp={() => {
                    if (drawing.current) {
                      drawing.current = false;
                      finishPath();
                    }
                  }}
                >
                  <Layer scaleX={size.w / 900} scaleY={size.w / 900}>
                    {Array.from({ length: 19 }, (_, i) => (
                      <Line
                        key={`x${i}`}
                        points={[i * 50, 0, i * 50, 550]}
                        stroke="#242e33"
                        strokeWidth={0.6}
                      />
                    ))}
                    {Array.from({ length: 12 }, (_, i) => (
                      <Line
                        key={`y${i}`}
                        points={[0, i * 50, 900, i * 50]}
                        stroke="#242e33"
                        strokeWidth={0.6}
                      />
                    ))}
                    {s.decor.map((d) => (
                      <Group
                        key={d.id}
                        x={d.x}
                        y={d.y}
                        draggable={tool === "select"}
                        onDragEnd={(e) =>
                          edit(
                            {
                              ...s,
                              decor: s.decor.map((x) =>
                                x.id === d.id
                                  ? { ...x, x: e.target.x(), y: e.target.y() }
                                  : x,
                              ),
                            },
                            "Equipment moved.",
                          )
                        }
                      >
                        <Rect
                          width={d.name === "DJ booth" ? 160 : 55}
                          height={55}
                          fill="#29353b"
                          stroke="#52646c"
                          cornerRadius={5}
                        />
                        <Text
                          text={d.name}
                          x={10}
                          y={21}
                          fill="#becdd4"
                          fontSize={12}
                        />
                      </Group>
                    ))}
                    {s.geometry.map((g) => {
                      const f = s.fixtures.find((f) => f.id === g.fixtureId);
                      if (!f) return null;
                      const c = s.connections.find((c) => c.fixtureId === f.id),
                        online = s.controllers.find(
                          (x) => x.id === c?.controllerId,
                        )?.online;
                      return (
                        <Group
                          key={f.id}
                          x={g.x}
                          y={g.y}
                          draggable={tool === "select"}
                          onClick={(e) => {
                            if (tool === "select") choose(f.id, e.evt.shiftKey);
                          }}
                          onDragEnd={(e) => {
                            edit(
                              {
                                ...s,
                                geometry: s.geometry.map((x) =>
                                  x.fixtureId === f.id
                                    ? {
                                        ...x,
                                        x:
                                          Math.round(
                                            Math.max(
                                              0,
                                              Math.min(850, e.target.x()),
                                            ) / 10,
                                          ) * 10,
                                        y:
                                          Math.round(
                                            Math.max(
                                              0,
                                              Math.min(500, e.target.y()),
                                            ) / 10,
                                          ) * 10,
                                      }
                                    : x,
                                ),
                              },
                              "Fixture moved. Physical patch unchanged.",
                            );
                          }}
                        >
                          {g.kind === "wash" ? (
                            <>
                              <Line
                                points={[0, 0, -75, -130, 75, -130]}
                                closed
                                fill={paletteColor(f)}
                                opacity={0.09}
                              />
                              <Circle
                                radius={22}
                                fill="#25353b"
                                stroke={
                                  selected.includes(f.id)
                                    ? "#f1fff8"
                                    : paletteColor(f)
                                }
                                strokeWidth={3}
                              />
                              <Circle
                                radius={8}
                                fill={paletteColor(f)}
                                opacity={online ? 1 : 0.4}
                              />
                            </>
                          ) : (
                            <>
                              <Line
                                points={g.points}
                                tension={g.kind === "curve" ? 0.5 : 0}
                                stroke={paletteColor(f)}
                                opacity={0.12}
                                strokeWidth={20}
                                lineCap="round"
                              />
                              <Line
                                points={g.points}
                                tension={g.kind === "curve" ? 0.5 : 0}
                                stroke={
                                  selected.includes(f.id)
                                    ? "#e5fff6"
                                    : paletteColor(f)
                                }
                                strokeWidth={selected.includes(f.id) ? 5 : 3}
                                lineCap="round"
                                dash={online ? undefined : [10, 7]}
                                hitStrokeWidth={24}
                              />
                              <Circle
                                x={
                                  g.points[
                                    c?.reversed ? g.points.length - 2 : 0
                                  ]
                                }
                                y={
                                  g.points[
                                    c?.reversed ? g.points.length - 1 : 1
                                  ]
                                }
                                radius={5}
                                fill={paletteColor(f)}
                              />
                            </>
                          )}
                          <Text
                            text={`${f.name}${online ? "" : " · offline"}`}
                            x={g.kind === "wash" ? -45 : 0}
                            y={g.kind === "wash" ? 35 : -28}
                            fill="#dbe8ed"
                            fontSize={13}
                          />
                          {selected.includes(f.id) &&
                            tool === "select" &&
                            g.kind !== "wash" &&
                            g.points
                              .filter((_, i) => i % 2 === 0)
                              .map((_, i) => (
                                <Circle
                                  key={i}
                                  x={g.points[i * 2]}
                                  y={g.points[i * 2 + 1]}
                                  radius={6}
                                  fill="#101417"
                                  stroke="#79f2c0"
                                  draggable
                                  onDragEnd={(e) => {
                                    e.cancelBubble = true;
                                    const next = [...g.points];
                                    next[i * 2] = e.target.x();
                                    next[i * 2 + 1] = e.target.y();
                                    updateGeo({ points: next });
                                  }}
                                />
                              ))}
                        </Group>
                      );
                    })}
                    {points.length > 1 && (
                      <Line
                        points={points}
                        tension={tool === "curve" ? 0.5 : 0}
                        stroke="#79f2c0"
                        strokeWidth={3}
                      />
                    )}
                  </Layer>
                </Stage>
                <div className="canvasFooter">
                  <span>
                    <span className="dot" /> Fixture input / first pixel
                  </span>
                  <span>Dashed = offline · positions reserved</span>
                </div>
              </div>
              <div className="belowCanvas">
                <span>
                  {tool === "select"
                    ? "Drag fixtures to arrange. Edit coordinates in the inspector for precise placement."
                    : tool === "freehand"
                      ? "Drag across the stage to draw the selected strip. Escape cancels."
                      : "Click points on the stage, then finish the path. Escape cancels."}
                </span>
                {tool !== "select" && tool !== "freehand" && (
                  <button onClick={() => finishPath()}>Finish path</button>
                )}
              </div>
              <div className="paletteBar">
                <div>
                  <span className="eyebrow">COLOUR DIRECTION</span>
                  <h2>
                    {scope === "global"
                      ? "Global palette"
                      : "Selection override"}
                  </h2>
                </div>
                <div className="paletteOptions">
                  {palettes.map((p) => (
                    <button
                      key={p.id}
                      className={
                        s.globalPalette === p.id && scope === "global"
                          ? "chosen"
                          : ""
                      }
                      onClick={() =>
                        edit(
                          setPalette(
                            s,
                            p.id,
                            scope === "selection" ? selected : [],
                          ),
                          scope === "global"
                            ? "Global palette updated. Local overrides preserved."
                            : "Local palette override applied.",
                        )
                      }
                    >
                      <span
                        className="swatch"
                        style={{
                          background: `linear-gradient(90deg,${p.colors.join(",")})`,
                        }}
                      />
                      {p.name}
                    </button>
                  ))}
                </div>
                <Field label="Apply palette to">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="global">Whole rig (default)</option>
                    <option value="selection" disabled={!selected.length}>
                      Selected fixtures
                    </option>
                  </select>
                </Field>
              </div>
            </>
          ) : view === "patch" ? (
            <>
              <div className="toolbar">
                <span>{s.controllers.length} registered controllers</span>
                <button
                  className="primary"
                  onClick={() => {
                    if (s.controllers.some((c) => c.id === "c3")) {
                      setStatus(
                        "Simulated discovery finished. All demo controllers are already registered.",
                      );
                      return;
                    }
                    setFound(true);
                    setStatus(
                      "Simulated discovery finished. One controller found.",
                    );
                  }}
                >
                  <Plus size={15} /> Discover controllers
                </button>
              </div>
              {found && (
                <div className="discovery">
                  <div>
                    <strong>Portable controller</strong>
                    <p>192.0.2.30 · Demo device · 5 V SK6812</p>
                  </div>
                  <button
                    onClick={() => {
                      if (s.controllers.some((c) => c.id === "c3")) return;
                      edit(
                        {
                          ...s,
                          controllers: [
                            ...s.controllers,
                            {
                              id: "c3",
                              name: "Portable controller",
                              address: "192.0.2.30",
                              online: true,
                              ports: [
                                {
                                  id: "p4",
                                  name: "LED 1",
                                  voltage: 5,
                                  protocol: "SK6812",
                                  capacity: 120,
                                  channels: ["R", "G", "B", "W"],
                                },
                              ],
                            },
                          ],
                        },
                        "Demo controller registered.",
                      );
                      setFound(false);
                    }}
                  >
                    Register
                  </button>
                  <button onClick={() => setFound(false)}>Dismiss</button>
                </div>
              )}
              <div className="flow">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView
                  colorMode="dark"
                  nodesDraggable={false}
                  onNodeClick={(_, node) => {
                    if (!node.id.includes(":")) choose(node.id);
                  }}
                  onConnect={(c) => connect(edgeCandidate(c))}
                  isValidConnection={(c) =>
                    !validateConnection(s, edgeCandidate(c))
                  }
                  onConnectEnd={(_, state) => {
                    if (!state.isValid)
                      setError(
                        "Connection not made. Use the output form to check voltage, protocol, channels and pixel range.",
                      );
                  }}
                >
                  <Background color="#34424b" gap={24} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
              <div className="belowCanvas">
                Drag from an output to a fixture, or use the accessible
                connection form. Port range uses the form’s start pixel.
              </div>
            </>
          ) : (
            <>
              <div className="libraryTabs">
                {[
                  "Rigs",
                  "Scenes",
                  "Effect presets",
                  "Colour presets",
                  "Profiles",
                ].map((t) => (
                  <button
                    key={t}
                    className={t === tab ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Profiles" ? (
                <Profiles s={s} edit={edit} setError={setError} />
              ) : (
                <>
                  <div className="saveRow">
                    <Field
                      label={`New ${tab.toLowerCase().replace("s", "")} name`}
                    >
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <button
                      className="primary"
                      onClick={() => {
                        if (!name.trim()) {
                          setError("Give this item a name.");
                          return;
                        }
                        const id = uid(),
                          base = { id, name: name.trim() };
                        if (tab === "Rigs")
                          edit(
                            {
                              ...s,
                              rigs: [...s.rigs, snapshotRig(s, name.trim())],
                            },
                            "Rig saved with stable fixture IDs and stage positions.",
                          );
                        else if (tab === "Effect presets")
                          edit(
                            {
                              ...s,
                              effectPresets: [
                                ...s.effectPresets,
                                {
                                  ...base,
                                  assignments: s.fixtures.map((f) => ({
                                    id: f.id,
                                    effect: f.effect,
                                  })),
                                },
                              ],
                            },
                            "Effect preset saved independently of colours.",
                          );
                        else if (tab === "Colour presets")
                          edit(
                            {
                              ...s,
                              colourPresets: [
                                ...s.colourPresets,
                                {
                                  ...base,
                                  globalPalette: s.globalPalette,
                                  overrides: s.fixtures.map((f) => ({
                                    id: f.id,
                                    paletteId: f.paletteId,
                                  })),
                                },
                              ],
                            },
                            "Colour preset saved independently of effects.",
                          );
                        else if (
                          !s.effectPresets.length ||
                          !s.colourPresets.length
                        )
                          setError(
                            "Save an effect preset and a colour preset first. A scene pairs these two parts.",
                          );
                        else
                          edit(
                            {
                              ...s,
                              scenes: [
                                ...s.scenes,
                                {
                                  ...base,
                                  effectId:
                                    s.effectPresets.find(
                                      (p) => p.id === effectChoice,
                                    )?.id || s.effectPresets[0].id,
                                  colourId:
                                    s.colourPresets.find(
                                      (p) => p.id === colourChoice,
                                    )?.id || s.colourPresets[0].id,
                                },
                              ],
                            },
                            "Scene saved with the chosen effect and colour presets.",
                          );
                      }}
                    >
                      Save{" "}
                      {tab === "Rigs"
                        ? "rig"
                        : tab === "Scenes"
                          ? "scene"
                          : "preset"}
                    </button>
                  </div>
                  {tab === "Scenes" && (
                    <div className="twoCols">
                      <Field label="Scene effect preset">
                        <select
                          value={effectChoice || s.effectPresets[0]?.id || ""}
                          onChange={(e) => setEffectChoice(e.target.value)}
                        >
                          <option value="" disabled>
                            Save an effect preset first
                          </option>
                          {s.effectPresets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Scene colour preset">
                        <select
                          value={colourChoice || s.colourPresets[0]?.id || ""}
                          onChange={(e) => setColourChoice(e.target.value)}
                        >
                          <option value="" disabled>
                            Save a colour preset first
                          </option>
                          {s.colourPresets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                  <div className="libraryGrid">
                    {(tab === "Rigs"
                      ? s.rigs
                      : tab === "Scenes"
                        ? s.scenes
                        : tab === "Effect presets"
                          ? s.effectPresets
                          : s.colourPresets
                    ).map((item) => (
                      <article key={item.id}>
                        <Layers size={22} />
                        <h2>{item.name}</h2>
                        <p>
                          {tab === "Rigs"
                            ? `${item.fixtures.length} fixtures · saved geometry`
                            : tab === "Scenes"
                              ? "Effect + colour pairing"
                              : "Reusable arrangement"}
                        </p>
                        <button
                          onClick={() => {
                            if (tab === "Rigs")
                              edit(
                                loadRig(s, item),
                                "Rig loaded. Offline fixtures retain their logical positions.",
                              );
                            else if (tab === "Effect presets")
                              edit(
                                {
                                  ...s,
                                  fixtures: s.fixtures.map((f) => ({
                                    ...f,
                                    effect:
                                      item.assignments.find(
                                        (a) => a.id === f.id,
                                      )?.effect || f.effect,
                                  })),
                                },
                                "Effects loaded. Colours preserved.",
                              );
                            else if (tab === "Colour presets")
                              edit(
                                {
                                  ...s,
                                  globalPalette: item.globalPalette,
                                  fixtures: s.fixtures.map((f) => ({
                                    ...f,
                                    paletteId:
                                      item.overrides.find((a) => a.id === f.id)
                                        ?.paletteId ?? null,
                                  })),
                                },
                                "Colours loaded. Effects preserved.",
                              );
                            else {
                              const ef = s.effectPresets.find(
                                  (p) => p.id === item.effectId,
                                ),
                                co = s.colourPresets.find(
                                  (p) => p.id === item.colourId,
                                );
                              if (!ef || !co) {
                                setError(
                                  "Scene references a missing preset. Choose another scene.",
                                );
                                return;
                              }
                              edit(
                                {
                                  ...s,
                                  globalPalette: co.globalPalette,
                                  fixtures: s.fixtures.map((f) => ({
                                    ...f,
                                    effect:
                                      ef.assignments.find((a) => a.id === f.id)
                                        ?.effect || f.effect,
                                    paletteId:
                                      co.overrides.find((a) => a.id === f.id)
                                        ?.paletteId ?? null,
                                  })),
                                },
                                "Scene loaded in simulation.",
                              );
                            }
                          }}
                        >
                          Load <ArrowRight size={14} />
                        </button>
                      </article>
                    ))}
                  </div>
                  {!(
                    tab === "Rigs"
                      ? s.rigs
                      : tab === "Scenes"
                        ? s.scenes
                        : tab === "Effect presets"
                          ? s.effectPresets
                          : s.colourPresets
                  ).length && (
                    <div className="empty">
                      <Library size={32} />
                      <h2>Your library starts here</h2>
                      <p>
                        Save your current{" "}
                        {tab === "Rigs"
                          ? "fixture layout"
                          : tab === "Scenes"
                            ? "effect and colour pairing"
                            : "arrangement"}{" "}
                        to use it again.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
        <aside className="inspector">
          <div className="panelHeading">
            <h2>Inspector</h2>
            <span className="count">{selected.length} selected</span>
          </div>
          {fixture ? (
            <>
              <span className="eyebrow">
                {selected.length > 1
                  ? "BULK EDIT"
                  : profile?.kind.toUpperCase()}
              </span>
              <h2 className="fixtureTitle">
                {selected.length > 1
                  ? `${selected.length} fixtures`
                  : fixture.name}
              </h2>
              <p className="hint">
                {profile?.name} · {profile?.pixels} px
              </p>
              {selected.length === 1 && (
                <Field label="Fixture display name">
                  <input
                    value={fixture.name}
                    onChange={(e) => updateFixture({ name: e.target.value })}
                  />
                </Field>
              )}
              <section>
                <h3>Look</h3>
                <Field label="Effect">
                  <select
                    value={
                      selected.every(
                        (id) =>
                          s.fixtures.find((f) => f.id === id)?.effect ===
                          fixture.effect,
                      )
                        ? fixture.effect
                        : ""
                    }
                    onChange={(e) => updateFixture({ effect: e.target.value })}
                  >
                    <option value="" disabled>
                      Mixed effects
                    </option>
                    {["Energy", "Solid", "Spectrum", "Wave", "Pulse"].map(
                      (e) => (
                        <option key={e}>{e}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Palette source">
                  <select
                    value={fixture.paletteId || ""}
                    onChange={(e) =>
                      updateFixture({ paletteId: e.target.value || null })
                    }
                  >
                    <option value="">Follow global palette</option>
                    {palettes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · local
                      </option>
                    ))}
                  </select>
                </Field>
                {profile?.channels.includes("UV") && (
                  <Field label={`Independent UV · ${fixture.uv}%`}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fixture.uv}
                      onChange={(e) =>
                        updateFixture({ uv: Number(e.target.value) })
                      }
                    />
                    <small>
                      Explicit control. RGB palettes never drive UV.
                    </small>
                  </Field>
                )}
              </section>
              {selected.length === 1 && (
                <>
                  <section>
                    <h3>Stage geometry</h3>
                    {geo && (
                      <>
                        <div className="twoCols">
                          <Field label="X position">
                            <input
                              type="number"
                              value={geo.x}
                              onChange={(e) =>
                                updateGeo({
                                  x: Math.max(
                                    0,
                                    Math.min(850, Number(e.target.value)),
                                  ),
                                })
                              }
                            />
                          </Field>
                          <Field label="Y position">
                            <input
                              type="number"
                              value={geo.y}
                              onChange={(e) =>
                                updateGeo({
                                  y: Math.max(
                                    0,
                                    Math.min(500, Number(e.target.value)),
                                  ),
                                })
                              }
                            />
                          </Field>
                        </div>
                        {profile?.kind === "strip" && (
                          <>
                            <Field label="Path shape">
                              <select
                                value={geo.kind}
                                onChange={(e) =>
                                  updateGeo({ kind: e.target.value })
                                }
                              >
                                <option value="straight">Straight</option>
                                <option value="curve">Curve</option>
                                <option value="freehand">Freehand</option>
                              </select>
                            </Field>
                            <details>
                              <summary>Edit path points</summary>
                              <p className="hint">
                                Coordinates relative to fixture position.
                              </p>
                              {Array.from(
                                { length: geo.points.length / 2 },
                                (_, i) => (
                                  <div className="twoCols" key={i}>
                                    {["X", "Y"].map((axis, j) => (
                                      <Field
                                        key={axis}
                                        label={`Point ${i + 1} ${axis}`}
                                      >
                                        <input
                                          type="number"
                                          value={geo.points[i * 2 + j]}
                                          onChange={(e) => {
                                            const p = [...geo.points];
                                            p[i * 2 + j] = Number(
                                              e.target.value,
                                            );
                                            updateGeo({ points: p });
                                          }}
                                        />
                                      </Field>
                                    ))}
                                  </div>
                                ),
                              )}
                            </details>
                          </>
                        )}
                      </>
                    )}
                  </section>
                  <section>
                    <h3>Physical connection</h3>
                    <p className="hint">
                      {connection
                        ? `${s.controllers.find((c) => c.id === connection.controllerId)?.name} / ${connection.portId}`
                        : "Not patched yet"}
                    </p>
                    <Field label="Controller output">
                      <select
                        value={portChoice}
                        onChange={(e) => setPortChoice(e.target.value)}
                      >
                        {s.controllers.flatMap((c) =>
                          c.ports.map((p) => (
                            <option key={p.id} value={`${c.id}:${p.id}`}>
                              {c.name} / {p.name}
                            </option>
                          )),
                        )}
                      </select>
                    </Field>
                    <Field label="Start pixel (1-based)">
                      <input
                        type="number"
                        min="1"
                        value={start + 1}
                        onChange={(e) => setStart(Number(e.target.value) - 1)}
                      />
                    </Field>
                    <button
                      className="wide"
                      onClick={() => {
                        const [controllerId, portId] = portChoice.split(":");
                        connect({
                          controllerId,
                          portId,
                          fixtureId: fixture.id,
                          start: Number(start),
                          count: profile.pixels,
                          reversed: connection?.reversed || false,
                        });
                      }}
                    >
                      Validate & patch
                    </button>
                    {connection && (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={connection.reversed}
                          onChange={(e) =>
                            connect({
                              ...connection,
                              reversed: e.target.checked,
                            })
                          }
                        />{" "}
                        Reverse pixel direction
                      </label>
                    )}
                    <button
                      className="wide"
                      disabled={!connection}
                      onClick={() => {
                        const c = s.controllers.find(
                          (c) => c.id === connection.controllerId,
                        );
                        edit(
                          {
                            ...s,
                            controllers: s.controllers.map((x) =>
                              x.id === c.id ? { ...x, online: !x.online } : x,
                            ),
                          },
                          `Simulated ${c.online ? "disconnect" : "reconnect"}. Stage positions preserved.`,
                        );
                      }}
                    >
                      Simulate{" "}
                      {s.controllers.find(
                        (c) => c.id === connection?.controllerId,
                      )?.online
                        ? "disconnect"
                        : "reconnect"}
                    </button>
                  </section>
                </>
              )}
            </>
          ) : (
            <div className="empty">
              <Move size={24} />
              <p>Select a fixture on the stage or in the list.</p>
            </div>
          )}
          <div className="inspectorNote">
            <strong>Safe to explore</strong>
            <p>
              All controllers and effects are simulated. This prototype cannot
              send data to your lights.
            </p>
            <button
              onClick={() => {
                const raw = localStorage.getItem(KEY + "-recovery");
                if (!raw) {
                  setStatus("No recovery data is stored.");
                  return;
                }
                const a = document.createElement("a");
                a.href = URL.createObjectURL(
                  new Blob([raw], { type: "application/json" }),
                );
                a.download = "studio-recovery.json";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Export recovery data
            </button>
          </div>
          <details className="equipmentControls">
            <summary>Equipment positions</summary>
            {s.decor.map((d) => (
              <div key={d.id}>
                <h3>{d.name}</h3>
                <div className="twoCols">
                  {["x", "y"].map((axis) => (
                    <Field key={axis} label={`${d.name} ${axis.toUpperCase()}`}>
                      <input
                        type="number"
                        value={d[axis]}
                        onChange={(e) =>
                          edit(
                            {
                              ...s,
                              decor: s.decor.map((item) =>
                                item.id === d.id
                                  ? { ...item, [axis]: Number(e.target.value) }
                                  : item,
                              ),
                            },
                            "Equipment position updated.",
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </details>
        </aside>
      </div>
      <footer role="status" aria-live="polite">
        <span className="dot" />
        {status}
        <span className="footerRight">LedFX engine integration · planned</span>
      </footer>
    </div>
  );
}
function Profiles({ s, edit, setError }) {
  const [id, setId] = useState("rgb"),
    [name, setName] = useState("Custom strip"),
    [voltage, setVoltage] = useState(12),
    [pixels, setPixels] = useState(60);
  const p = s.profiles.find((p) => p.id === id);
  return (
    <>
      <div className="libraryGrid">
        {s.profiles.map((p) => (
          <article key={p.id}>
            <h2>{p.name}</h2>
            <p>
              {p.voltage} V · {p.protocol} · {p.pixels} px
            </p>
            <span className="channelTag">{p.channels.join(" / ")}</span>
            <button
              onClick={() => {
                setId(p.id);
                setName(`${p.name} v2`);
                setVoltage(p.voltage);
                setPixels(p.pixels);
                document.querySelector(".profileForm input")?.focus();
              }}
            >
              Edit as copy
            </button>
          </article>
        ))}
      </div>
      <section className="profileForm">
        <h2>Create a reusable profile</h2>
        <p className="hint">
          Duplicate a channel-safe template. Changes do not alter existing
          fixtures.
        </p>
        <Field label="Base profile">
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              const p = s.profiles.find((p) => p.id === e.target.value);
              setVoltage(p.voltage);
              setPixels(p.pixels);
            }}
          >
            {s.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Profile name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="twoCols">
          <Field label="Voltage (V)">
            <input
              type="number"
              value={voltage}
              onChange={(e) => setVoltage(Number(e.target.value))}
            />
          </Field>
          <Field label="Pixel count">
            <input
              type="number"
              value={pixels}
              onChange={(e) => setPixels(Number(e.target.value))}
            />
          </Field>
        </div>
        <button
          className="primary"
          onClick={() => {
            if (
              !name.trim() ||
              ![5, 12, 24].includes(voltage) ||
              !Number.isInteger(pixels) ||
              pixels < 1 ||
              pixels > 4096 ||
              (p.kind === "wash" && pixels !== 1)
            ) {
              setError(
                "Use a name, 5/12/24 V, and 1–4096 pixels (wash lights require 1).",
              );
              return;
            }
            edit(
              {
                ...s,
                profiles: [
                  ...s.profiles,
                  {
                    ...p,
                    id: uid(),
                    name: name.trim(),
                    voltage,
                    pixels,
                  },
                ],
              },
              "Reusable profile created. Existing profiles remain unchanged.",
            );
          }}
        >
          Save profile
        </button>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
