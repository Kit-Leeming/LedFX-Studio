import React, { useEffect, useRef, useState } from "react";
import {
  Cpu,
  Network,
  Layers,
  Sparkles,
  Undo2,
  Download,
  RefreshCw,
  Radio,
} from "lucide-react";
import { load, request } from "./api";
import { emptyWorkspace, validateWorkspace, count } from "./domain";
import { ErrorBox } from "./components";
import Devices from "./Devices";
import Patches from "./Patches";
import StageView from "./StageView";
import Effects from "./Effects";
const views = [
  ["devices", "Devices", Cpu],
  ["patches", "Patches", Network],
  ["stage", "Stage", Layers],
  ["effects", "Effects & palettes", Sparkles],
];
const activeView = () =>
  views.some((v) => v[0] === location.hash.slice(1))
    ? location.hash.slice(1)
    : "devices";
export default function App() {
  const [engine, setEngine] = useState(null),
    [schema, setSchema] = useState({}),
    [devices, setDevices] = useState({}),
    [view, setView] = useState(activeView),
    [selected, setSelected] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Connecting to LedFX…"),
    [history, setHistory] = useState([]);
  const latest = useRef(),
    lock = useRef(false);
  const workspace = engine?.library.workspace || emptyWorkspace();
  function accept(s) {
    latest.current = s;
    setEngine(s);
  }
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const [s, schemas, d] = await load();
      if (s.library.workspace) validateWorkspace(s.library.workspace);
      accept(s);
      setSchema(schemas.effects);
      setDevices(d.devices);
      setStatus("Connected to LedFX.");
      setError("");
      setHistory([]);
    } catch (e) {
      setError(e.message || "Could not connect to LedFX.");
      setStatus("Connection unavailable. Start LedFX and retry.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    refresh();
    const fn = () => setView(activeView());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  async function transaction(fn) {
    if (lock.current)
      throw Error("Another change is being saved. Please wait.");
    lock.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(next, message, { undo = true } = {}) {
    validateWorkspace(next);
    return transaction(async () => {
      const previous = latest.current.library.workspace || emptyWorkspace();
      const result = await request("/api/studio", "PUT", {
        ...latest.current.library,
        workspace: next,
      });
      accept(result);
      if (undo)
        setHistory((h) => [
          ...h.slice(-29),
          { kind: "workspace", before: previous, after: JSON.stringify(next) },
        ]);
      setStatus(message);
      setError("");
    });
  }
  async function saveLibrary(library, message) {
    return transaction(async () => {
      const result = await request("/api/studio", "PUT", {
        ...library,
        revision: latest.current.library.revision,
      });
      accept(result);
      setStatus(message);
      setError("");
    });
  }
  async function apply(changes, lights, message, nextWorkspace) {
    if (latest.current.workspace_version !== 3)
      throw Error(
        "Update the installed LedFX backend before applying effects from this Studio version.",
      );
    if (!lights.length) throw Error("Select at least one light.");
    for (const l of lights) {
      const v = latest.current.virtuals[l.virtualId];
      if (!v)
        throw Error(
          `${l.name} has no configured LedFX output. Link it in Devices first.`,
        );
      if (v.pixel_count !== count(l))
        throw Error(
          `${l.name}: LedFX pixel count changed. Review its device definition before applying effects.`,
        );
      if (l.kind === "matrix" && Number(v.config?.rows || 1) !== l.rows)
        throw Error(
          `${l.name}: the LedFX virtual's matrix rows do not match Devices.`,
        );
    }
    if (new Set(changes.map((c) => c.id)).size !== changes.length)
      throw Error(
        "Two lights share a LedFX output. Correct their connections in Devices.",
      );
    await transaction(async () => {
      const previous = latest.current.library.workspace;
      const result = await request("/api/studio", "POST", {
        action: "apply",
        revision: latest.current.library.revision,
        changes,
        ...(nextWorkspace ? { workspace: nextWorkspace } : {}),
      });
      if (
        nextWorkspace &&
        JSON.stringify(result.library.workspace) !==
          JSON.stringify(nextWorkspace)
      )
        throw Error(
          "The running backend is too old to save palette scope safely. Update the LedFX installation, then refresh.",
        );
      accept(result);
      setHistory((h) => [
        ...h.slice(-29),
        { kind: "effect", before: previous, operation: result.last_operation },
      ]);
      setStatus(message);
      setError("");
    });
  }
  async function undo() {
    const h = history.at(-1);
    if (!h) return;
    try {
      if (h.kind === "workspace") {
        if (JSON.stringify(latest.current.library.workspace) !== h.after)
          throw Error("Studio changed elsewhere. Refresh before undoing.");
        await save(h.before, "Workspace change undone.", { undo: false });
      } else
        await transaction(async () => {
          const result = await request("/api/studio", "POST", {
            action: "undo",
            operation_id: h.operation,
          });
          accept(result);
          setStatus("Effect change undone.");
        });
      setHistory((x) => x.slice(0, -1));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function exportBackup() {
    if (!engine) return;
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(engine.library, null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app">
      <a
        className="skip"
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("workspace").focus();
        }}
      >
        Skip to workspace
      </a>
      <header className="appHeader">
        <a className="brand" href="#devices">
          <Radio size={23} />
          <strong>
            LedFX <span>STUDIO</span>
          </strong>
        </a>
        <div className="headerActions">
          <span className="connectionState">
            {busy
              ? "Saving / loading…"
              : engine
                ? "Connected to LedFX"
                : "Disconnected"}
          </span>
          <button onClick={undo} disabled={busy || !history.length}>
            <Undo2 size={16} /> Undo
          </button>
          <button onClick={exportBackup} disabled={!engine}>
            <Download size={16} /> Backup
          </button>
          <button
            aria-label="Refresh from LedFX"
            disabled={busy}
            onClick={refresh}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      <nav className="mainNav" aria-label="Main navigation">
        {views.map(([id, name, Icon]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon size={18} />
            {name}
          </a>
        ))}
      </nav>
      <main id="workspace" tabIndex={-1}>
        <ErrorBox>{error}</ErrorBox>
        {!engine ? (
          <section className="connectionScreen">
            <h1>Connect to LedFX</h1>
            <p>
              Studio runs on the existing LedFX backend. Your saved devices and
              layouts will appear when it is available.
            </p>
            <button disabled={busy} className="primary" onClick={refresh}>
              Retry connection
            </button>
            <a href="/" target="_blank" rel="noopener">
              Open classic LedFX
            </a>
          </section>
        ) : view === "devices" ? (
          <Devices
            workspace={workspace}
            save={save}
            busy={busy}
            virtuals={engine.virtuals}
            devices={devices}
          />
        ) : view === "patches" ? (
          <Patches workspace={workspace} save={save} busy={busy} />
        ) : view === "stage" ? (
          <StageView
            workspace={workspace}
            save={save}
            busy={busy}
            selected={selected}
            setSelected={setSelected}
          />
        ) : (
          <Effects
            workspace={workspace}
            save={save}
            busy={busy}
            selected={selected}
            setSelected={setSelected}
            engine={engine}
            schemas={schema}
            apply={apply}
            saveLibrary={saveLibrary}
          />
        )}
      </main>
      <footer role="status" aria-live="polite">
        {status}
        <a href="/" target="_blank" rel="noopener">
          Classic LedFX
        </a>
      </footer>
    </div>
  );
}
