import { useState } from 'react';
import type { V2BodyStats } from './character/v2Topology';
import { CharacterViewport } from './scene/CharacterViewport';
import type {
  DisplayMode,
  ProjectionMode,
  ViewPreset,
} from './scene/viewTypes';

const DISPLAY_MODES: readonly DisplayMode[] = [
  'shaded',
  'wireframe',
  'overlay',
  'regions',
];

const PROJECTION_MODES: readonly ProjectionMode[] = [
  'perspective',
  'orthographic',
];

const VIEW_PRESETS: readonly ViewPreset[] = [
  'perspective',
  'front',
  'back',
  'left',
  'right',
  'top',
];

function readEnumParam<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = new URLSearchParams(window.location.search).get(key) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}

function readBooleanParam(
  key: string,
  fallback: boolean,
): boolean {
  const value = new URLSearchParams(window.location.search).get(key);

  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;

  return fallback;
}

interface SegmentedButtonProps<T extends string> {
  value: T;
  current: T;
  label: string;
  onChange: (value: T) => void;
}

function SegmentedButton<T extends string>({
  value,
  current,
  label,
  onChange,
}: SegmentedButtonProps<T>) {
  return (
    <button
      type="button"
      className={
        value === current
          ? 'segment-button is-active'
          : 'segment-button'
      }
      aria-pressed={value === current}
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  );
}

interface ToggleRowProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleRow({
  label,
  enabled,
  onChange,
}: ToggleRowProps) {
  return (
    <button
      type="button"
      className={
        enabled
          ? 'debug-toggle is-active'
          : 'debug-toggle'
      }
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
    >
      <span>{label}</span>
      <strong>{enabled ? 'ON' : 'OFF'}</strong>
    </button>
  );
}

export default function App() {
  const [displayMode, setDisplayMode] =
    useState<DisplayMode>(() =>
      readEnumParam('mode', DISPLAY_MODES, 'overlay'),
    );

  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>(() =>
      readEnumParam(
        'projection',
        PROJECTION_MODES,
        'perspective',
      ),
    );

  const [viewPreset, setViewPreset] =
    useState<ViewPreset>(() =>
      readEnumParam(
        'view',
        VIEW_PRESETS,
        'perspective',
      ),
    );

  const [showGuides, setShowGuides] = useState(() =>
    readBooleanParam('guides', false),
  );

  const [showGrid, setShowGrid] = useState(() =>
    readBooleanParam('grid', true),
  );

  const [stats, setStats] = useState<V2BodyStats>({
    surfaceComponents: 0,
    vertices: 0,
    triangles: 0,
    faceGroups: 0,
    anchors: 0,
    triangleBudget: 550,
    meshValid: false,
  });

  const budgetRatio =
    stats.triangleBudget > 0
      ? stats.triangles / stats.triangleBudget
      : 0;

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div>
          <p className="eyebrow">WANHU CHARACTER LAB</p>
          <h1>程序化人物生成实验</h1>
        </div>
        <div className="phase-badge">
          Phase 3 · V2 Continuous Base Body
        </div>
      </header>

      <section className="lab-content">
        <aside className="control-panel">
          <section className="control-section">
            <div className="section-heading">
              <span className="panel-kicker">
                V2 FIXED TOPOLOGY
              </span>
              <h2>连续基础人体</h2>
            </div>

            <div className="architecture-note v2-status-note">
              <span>当前阶段</span>
              <strong>固定 Default Body · A-Pose</strong>
              <p>
                这一轮只审固定连续拓扑。身高、体型、肩宽等参数暂时冻结，
                避免把“拓扑是否正确”和“参数变形是否正确”混在一起。
              </p>
            </div>
          </section>

          <section className="control-section debug-section">
            <div className="section-heading">
              <span className="panel-kicker">
                DEBUG VIEW
              </span>
              <h2>拓扑观察</h2>
            </div>

            <span className="control-group-label">
              显示模式
            </span>

            <div className="segment-grid segment-grid-four">
              <SegmentedButton
                value="shaded"
                current={displayMode}
                label="实体"
                onChange={setDisplayMode}
              />
              <SegmentedButton
                value="wireframe"
                current={displayMode}
                label="线框"
                onChange={setDisplayMode}
              />
              <SegmentedButton
                value="overlay"
                current={displayMode}
                label="叠加"
                onChange={setDisplayMode}
              />
              <SegmentedButton
                value="regions"
                current={displayMode}
                label="Face Group"
                onChange={setDisplayMode}
              />
            </div>

            <div className="debug-toggle-stack">
              <ToggleRow
                label="Garment Anchor Loops"
                enabled={showGuides}
                onChange={setShowGuides}
              />
              <ToggleRow
                label="地面网格 / 坐标轴"
                enabled={showGrid}
                onChange={setShowGrid}
              />
            </div>

            <span className="control-group-label">
              投影
            </span>

            <div className="segment-grid">
              <SegmentedButton
                value="perspective"
                current={projectionMode}
                label="透视"
                onChange={setProjectionMode}
              />
              <SegmentedButton
                value="orthographic"
                current={projectionMode}
                label="正交"
                onChange={setProjectionMode}
              />
            </div>

            <span className="control-group-label">
              固定视角
            </span>

            <div className="view-grid">
              <SegmentedButton
                value="perspective"
                current={viewPreset}
                label="3/4"
                onChange={setViewPreset}
              />
              <SegmentedButton
                value="front"
                current={viewPreset}
                label="前"
                onChange={setViewPreset}
              />
              <SegmentedButton
                value="back"
                current={viewPreset}
                label="后"
                onChange={setViewPreset}
              />
              <SegmentedButton
                value="left"
                current={viewPreset}
                label="左"
                onChange={setViewPreset}
              />
              <SegmentedButton
                value="right"
                current={viewPreset}
                label="右"
                onChange={setViewPreset}
              />
              <SegmentedButton
                value="top"
                current={viewPreset}
                label="顶"
                onChange={setViewPreset}
              />
            </div>
          </section>

          <section className="control-section metrics-section">
            <span className="control-group-label">
              V2 Topology Stats
            </span>

            <div className="topology-stats">
              <div>
                <span>Surface</span>
                <strong>{stats.surfaceComponents}</strong>
              </div>
              <div>
                <span>Vertices</span>
                <strong>{stats.vertices}</strong>
              </div>
              <div>
                <span>Triangles</span>
                <strong>{stats.triangles}</strong>
              </div>
              <div>
                <span>Face Groups</span>
                <strong>{stats.faceGroups}</strong>
              </div>
              <div>
                <span>Anchors</span>
                <strong>{stats.anchors}</strong>
              </div>
              <div>
                <span>Mesh Check</span>
                <strong>
                  {stats.meshValid ? 'PASS' : 'FAIL'}
                </strong>
              </div>
              <div className="stats-wide">
                <span>Budget</span>
                <strong>
                  {stats.triangles} / {stats.triangleBudget}
                  {' · '}
                  {Math.round(budgetRatio * 100)}%
                </strong>
              </div>
            </div>
          </section>

          <div className="architecture-note">
            <span>当前验证</span>
            <strong>
              Fixed Template → Closed Continuous Surface
            </strong>
            <p>
              肩、髋、颈、肘、膝现在属于同一张封闭人体 Surface。
              Face Group 和 Garment Anchor Loop 已作为固定拓扑语义写入。
            </p>
          </div>
        </aside>

        <section className="viewport-panel">
          <CharacterViewport
            displayMode={displayMode}
            projectionMode={projectionMode}
            viewPreset={viewPreset}
            showGuides={showGuides}
            showGrid={showGrid}
            onTopologyStats={setStats}
          />

          <div className="viewport-toolbar-hint">
            <span>{displayMode.toUpperCase()}</span>
            <span>
              {projectionMode === 'orthographic'
                ? 'ORTHO'
                : 'PERSP'}
            </span>
            {showGuides ? <span>ANCHORS</span> : null}
          </div>

          <div className="viewport-caption">
            <span>
              拖动旋转 · 滚轮缩放 · 右键平移
            </span>
            <span>
              V2 BaseBodyTopologyTemplate · External mesh assets: 0
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}
