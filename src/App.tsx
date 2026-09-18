import { useState } from "react";
import {
  CharacterViewport,
  type Stats,
  type View,
  type Display,
} from "./scene/CharacterViewport";
import {
  DEFAULT_RECIPE,
  cleanRecipe,
  type Recipe,
  type Motion,
  type Outfit,
} from "./character/v3/types";
import { MOTION_LABELS } from "./character/v3/rig";
const OUTFITS: { id: Outfit; name: string; desc: string; glyph: string }[] = [
  { id: "farmer", name: "农户", desc: "交领短衣 · 布鞋", glyph: "农" },
  { id: "guard", name: "卫兵", desc: "轻甲 · 剑与盾", glyph: "卫" },
  { id: "archer", name: "弓手", desc: "皮甲 · 弓与箭袋", glyph: "弓" },
  { id: "body", name: "基础人体", desc: "连续拓扑 · 无衣物", glyph: "体" },
];
const qs = new URLSearchParams(location.search);
function enumQuery<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = qs.get(key) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}
const initialPhase = () => {
  const n = Number(qs.get("phase") ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(0.999, n)) : 0;
};
const initialRecipe = () =>
  cleanRecipe({
    ...DEFAULT_RECIPE,
    outfit: (qs.get("outfit") ?? "farmer") as Outfit,
    hat: qs.get("hat") !== "0",
    equipment: qs.get("equipment") === "1",
  });
function exportRecipe(recipe: Recipe) {
  const blob = new Blob([JSON.stringify(recipe, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "wanhu-character-recipe.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [recipe, setRecipe] = useState<Recipe>(initialRecipe),
    [motion, setMotion] = useState<Motion>(
      enumQuery(
        "motion",
        ["idle", "walk", "run", "wave", "squat", "bind"] as const,
        "idle",
      ),
    ),
    [playing, setPlaying] = useState(!qs.has("paused")),
    [speed, setSpeed] = useState(1),
    [phase, setPhase] = useState(initialPhase);
  const [view, setView] = useState<View>(
      enumQuery(
        "view",
        ["free", "front", "side", "back", "top", "three"] as const,
        "free",
      ),
    ),
    [viewRevision, setViewRevision] = useState(0),
    [orthographic, setOrthographic] = useState(true),
    [display, setDisplay] = useState<Display>(
      enumQuery(
        "display",
        ["beauty", "cage", "triangles", "clay"] as const,
        "beauty",
      ),
    ),
    [skeleton, setSkeleton] = useState(false),
    [grid, setGrid] = useState(false),
    [error, setError] = useState(""),
    [stats, setStats] = useState<Stats | null>(null);
  const patch = (p: Partial<Recipe>) =>
    setRecipe((r) => cleanRecipe({ ...r, ...p }));
  const selectView = (v: View) => {
    setView(v);
    setViewRevision((n) => n + 1);
  };
  const outfit = OUTFITS.find((o) => o.id === recipe.outfit)!;
  return (
    <main className="studio">
      <header className="topbar">
        <div className="brand-mark">工</div>
        <div>
          <p className="eyebrow">WANHU / CHARACTER STUDIO</p>
          <h1>万户人物工坊</h1>
        </div>
        <div className="header-right">
          <span className="status-dot" />
          运行时生成 <span className="version">V3.0</span>
          <button className="ghost" onClick={() => exportRecipe(recipe)}>
            导出配方 ↗
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="section-title">
            <h2>角色外观</h2>
            <span>01 / APPEARANCE</span>
          </div>
          <div className="outfit-list">
            {OUTFITS.map((o) => (
              <button
                key={o.id}
                className={`outfit ${recipe.outfit === o.id ? "selected" : ""}`}
                aria-pressed={recipe.outfit === o.id}
                onClick={() =>
                  patch({
                    outfit: o.id,
                    equipment: o.id === "guard" || o.id === "archer",
                  })
                }
              >
                <span className={`outfit-glyph ${o.id}`}>{o.glyph}</span>
                <span>
                  <strong>{o.name}</strong>
                  <small>{o.desc}</small>
                </span>
                <span className="radio" />
              </button>
            ))}
          </div>
          <div className="switch-row">
            <label htmlFor="hat">头饰</label>
            <input
              id="hat"
              type="checkbox"
              checked={recipe.hat}
              disabled={recipe.outfit === "body"}
              onChange={(e) => patch({ hat: e.target.checked })}
            />
          </div>
          <div className="switch-row">
            <label htmlFor="equipment">手持装备</label>
            <input
              id="equipment"
              type="checkbox"
              checked={recipe.equipment}
              disabled={recipe.outfit === "body"}
              onChange={(e) => patch({ equipment: e.target.checked })}
            />
          </div>
          <div className="section-title spaced">
            <h2>身材与配色</h2>
            <button
              className="text-button"
              onClick={() => patch({ height: 1.76, build: 0.5, palette: 0 })}
            >
              重置
            </button>
          </div>
          <label className="slider-label">
            身高 <output>{recipe.height.toFixed(2)} m</output>
            <input
              aria-label="身高"
              type="range"
              min="1.58"
              max="1.92"
              step=".01"
              value={recipe.height}
              onChange={(e) => patch({ height: +e.target.value })}
            />
          </label>
          <label className="slider-label">
            体格{" "}
            <output>
              {
                ["偏瘦", "匀称", "壮实"][
                  recipe.build < 0.33 ? 0 : recipe.build > 0.66 ? 2 : 1
                ]
              }
            </output>
            <input
              aria-label="体格"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={recipe.build}
              onChange={(e) => patch({ build: +e.target.value })}
            />
          </label>
          <div className="palette-row">
            <span>布料色组</span>
            {["黛蓝", "苔绿", "赭红"].map((name, i) => (
              <button
                aria-label={name}
                title={name}
                key={name}
                className={`swatch swatch-${i} ${recipe.palette === i ? "active" : ""}`}
                onClick={() => patch({ palette: i })}
              />
            ))}
          </div>
          <div className="section-title spaced">
            <h2>检查工具</h2>
            <span>02 / INSPECT</span>
          </div>
          <div className="display-grid">
            {(
              [
                ["beauty", "着色"],
                ["clay", "素模"],
                ["cage", "结构布线"],
                ["triangles", "三角网格"],
              ] as [Display, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={display === id ? "active" : ""}
                aria-pressed={display === id}
                onClick={() => setDisplay(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="switch-row">
            <label htmlFor="skeleton">骨骼叠加</label>
            <input
              id="skeleton"
              type="checkbox"
              checked={skeleton}
              onChange={(e) => setSkeleton(e.target.checked)}
            />
          </div>
          <div className="switch-row">
            <label htmlFor="grid">地面网格</label>
            <input
              id="grid"
              type="checkbox"
              checked={grid}
              onChange={(e) => setGrid(e.target.checked)}
            />
          </div>
          <div className="metrics">
            <div>
              <span>人体基模</span>
              <strong>
                {stats?.bodyTriangles ?? "—"} <small>tris</small>
              </strong>
            </div>
            <div>
              <span>当前总面数</span>
              <strong data-testid="triangles">
                {stats?.triangles ?? "—"} <small>tris</small>
              </strong>
            </div>
            <div>
              <span>骨骼 / 权重</span>
              <strong>
                {stats?.bones ?? "—"} <small>/ ≤ 2</small>
              </strong>
            </div>
            <div>
              <span>渲染顶点</span>
              <strong>{stats?.gpuVertices ?? "—"}</strong>
            </div>
          </div>
          <p className="build-note">
            固定三维拓扑 · GPU 蒙皮
            <br />
            衣物替换覆盖的人体表面，无布料模拟。
          </p>
        </aside>
        <section className="stage" aria-label="人物预览">
          <div className="stage-heading">
            <p className="eyebrow">CHARACTER / {recipe.outfit.toUpperCase()}</p>
            <h2>{outfit.name}</h2>
            <p>同一人体与骨架，不同生活身份。</p>
          </div>
          <div className="camera-bar">
            {(
              [
                ["free", "自由"],
                ["front", "正面"],
                ["side", "侧面"],
                ["back", "背面"],
                ["three", "三视图"],
              ] as [View, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => selectView(v)}
              >
                {label}
              </button>
            ))}
            <button
              disabled={view === "three"}
              title="切换正交 / 透视相机"
              onClick={() => setOrthographic((v) => !v)}
            >
              {orthographic ? "正交" : "透视"}
            </button>
            <button
              title="保存当前预览截图"
              aria-label="保存截图"
              onClick={() => window.__WANHU_CAPTURE__?.()}
            >
              截 图
            </button>
          </div>
          {error ? (
            <div role="alert" className="error-panel">
              {error}
              <button onClick={() => location.reload()}>重新加载</button>
            </div>
          ) : (
            <CharacterViewport
              options={{
                recipe,
                motion,
                playing,
                speed,
                phase,
                view,
                viewRevision,
                orthographic,
                display,
                skeleton,
                grid,
              }}
              onStats={setStats}
              onError={setError}
            />
          )}
          {view === "three" && (
            <div className="three-labels">
              <span>FRONT / 正面</span>
              <span>SIDE / 侧面</span>
              <span>BACK / 背面</span>
            </div>
          )}
          <div className="stage-caption">
            <span>拖动旋转 · 右键平移 · 滚轮缩放</span>
            <span>1 SKINNED MESH · NO MODEL ASSETS</span>
          </div>
          <section className="motion-panel">
            <div className="motion-head">
              <span className="eyebrow">MOTION LAB</span>
              <div className="speed">
                <label htmlFor="speed">速度</label>
                <select
                  id="speed"
                  value={speed}
                  onChange={(e) => setSpeed(+e.target.value)}
                >
                  {[0.25, 0.5, 1, 1.5, 2].map((v) => (
                    <option key={v} value={v}>
                      {v}×
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="motion-actions">
              {(Object.keys(MOTION_LABELS) as Motion[]).map((m) => (
                <button
                  className={motion === m ? "active" : ""}
                  key={m}
                  onClick={() => {
                    setMotion(m);
                    setPhase(0);
                  }}
                >
                  {MOTION_LABELS[m]}
                </button>
              ))}
              <button
                className="play-button"
                aria-label={playing ? "暂停" : "播放"}
                onClick={() => setPlaying((v) => !v)}
              >
                {playing ? "Ⅱ 暂停" : "▶ 播放"}
              </button>
            </div>
            <label className="timeline">
              <span>逐帧审查</span>
              <input
                aria-label="动画进度"
                type="range"
                min="0"
                max=".999"
                step=".001"
                value={phase}
                onChange={(e) => {
                  setPlaying(false);
                  setPhase(+e.target.value);
                }}
              />
              <output>{Math.round(phase * 100)}%</output>
            </label>
          </section>
        </section>
      </div>
    </main>
  );
}
