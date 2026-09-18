import { useState } from 'react';
import {
  DEFAULT_BODY_PARAMETERS,
  type BodyParameters,
} from './character/types';
import type { TopologyStats } from './character/topology';
import { CharacterViewport } from './scene/CharacterViewport';
import type {
  DisplayMode,
  ProjectionMode,
  ViewPreset,
} from './scene/viewTypes';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: SliderFieldProps) {
  return (
    <label className="control-field">
      <span className="control-label">
        <span>{label}</span>
        <strong>
          {value.toFixed(step < 0.1 ? 2 : 1)}
          {suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
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
      className={value === current ? 'segment-button is-active' : 'segment-button'}
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

function ToggleRow({ label, enabled, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      className={enabled ? 'debug-toggle is-active' : 'debug-toggle'}
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
    >
      <span>{label}</span>
      <strong>{enabled ? 'ON' : 'OFF'}</strong>
    </button>
  );
}

export default function App() {
  const [parameters, setParameters] = useState<BodyParameters>(
    DEFAULT_BODY_PARAMETERS,
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>('overlay');
  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>('perspective');
  const [viewPreset, setViewPreset] = useState<ViewPreset>('perspective');
  const [showRings, setShowRings] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [stats, setStats] = useState<TopologyStats>({
    sections: 0,
    jointPatches: 0,
    rings: 0,
    vertices: 0,
    triangles: 0,
  });

  const patchParameters = (patch: Partial<BodyParameters>) => {
    setParameters((current) => ({ ...current, ...patch }));
  };

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div>
          <p className="eyebrow">WANHU CHARACTER LAB</p>
          <h1>程序化人物生成实验</h1>
        </div>
        <div className="phase-badge">Phase 1.5 · Shoulder JointPatch</div>
      </header>

      <section className="lab-content">
        <aside className="control-panel">
          <section className="control-section">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">BODY PARAMETERS</span>
                <h2>基础体型</h2>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setParameters(DEFAULT_BODY_PARAMETERS)}
              >
                重置
              </button>
            </div>

            <SliderField
              label="身高"
              value={parameters.height}
              min={1.5}
              max={1.95}
              step={0.01}
              suffix=" m"
              onChange={(height) => patchParameters({ height })}
            />

            <SliderField
              label="体型"
              value={parameters.build}
              min={0}
              max={1}
              step={0.01}
              onChange={(build) => patchParameters({ build })}
            />

            <SliderField
              label="肩宽"
              value={parameters.shoulderWidth}
              min={0.34}
              max={0.54}
              step={0.01}
              suffix=" m"
              onChange={(shoulderWidth) => patchParameters({ shoulderWidth })}
            />

            <SliderField
              label="头部比例"
              value={parameters.headScale}
              min={0.9}
              max={1.1}
              step={0.01}
              onChange={(headScale) => patchParameters({ headScale })}
            />
          </section>

          <section className="control-section debug-section">
            <div className="section-heading">
              <span className="panel-kicker">DEBUG VIEW</span>
              <h2>拓扑观察</h2>
            </div>

            <span className="control-group-label">显示模式</span>
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
                label="区域"
                onChange={setDisplayMode}
              />
            </div>

            <div className="debug-toggle-stack">
              <ToggleRow
                label="Ring Guides"
                enabled={showRings}
                onChange={setShowRings}
              />
              <ToggleRow
                label="地面网格 / 坐标轴"
                enabled={showGrid}
                onChange={setShowGrid}
              />
            </div>

            <span className="control-group-label">投影</span>
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

            <span className="control-group-label">固定视角</span>
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
            <span className="control-group-label">Topology Stats</span>
            <div className="topology-stats">
              <div>
                <span>Sections</span>
                <strong>{stats.sections}</strong>
              </div>
              <div>
                <span>JointPatch</span>
                <strong>{stats.jointPatches}</strong>
              </div>
              <div>
                <span>Rings</span>
                <strong>{stats.rings}</strong>
              </div>
              <div>
                <span>Vertices</span>
                <strong>{stats.vertices}</strong>
              </div>
              <div className="stats-wide">
                <span>Triangles</span>
                <strong>{stats.triangles}</strong>
              </div>
            </div>
          </section>

          <div className="architecture-note">
            <span>当前验证</span>
            <strong>
              Parameters → Blueprint → JointPatch → Rings → 1 Mesh
            </strong>
            <p>
              肩部已加入第一版 ShoulderPatch，手臂根部不再封口。当前 Patch
              仍与躯干侧面相交，下一步会继续处理共享边界与真正的无重叠焊接。
            </p>
          </div>
        </aside>

        <section className="viewport-panel">
          <CharacterViewport
            parameters={parameters}
            displayMode={displayMode}
            projectionMode={projectionMode}
            viewPreset={viewPreset}
            showRings={showRings}
            showGrid={showGrid}
            onTopologyStats={setStats}
          />

          <div className="viewport-toolbar-hint">
            <span>{displayMode.toUpperCase()}</span>
            <span>{projectionMode === 'orthographic' ? 'ORTHO' : 'PERSP'}</span>
            {showRings ? <span>RINGS</span> : null}
          </div>

          <div className="viewport-caption">
            <span>拖动旋转 · 滚轮缩放 · 右键平移</span>
            <span>HumanTopologyBlueprint v2 · External mesh assets: 0</span>
          </div>
        </section>
      </section>
    </main>
  );
}
