import { useState } from 'react';
import {
  DEFAULT_BODY_PARAMETERS,
  type BodyParameters,
} from './character/types';
import type { TopologyStats } from './character/topology';
import { CharacterViewport } from './scene/CharacterViewport';

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

export default function App() {
  const [parameters, setParameters] = useState<BodyParameters>(
    DEFAULT_BODY_PARAMETERS,
  );
  const [wireframe, setWireframe] = useState(false);
  const [stats, setStats] = useState<TopologyStats>({
    sections: 0,
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
        <div className="phase-badge">Phase 1 · Ring Topology</div>
      </header>

      <section className="lab-content">
        <aside className="control-panel">
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

          <button
            type="button"
            className={wireframe ? 'topology-toggle is-active' : 'topology-toggle'}
            onClick={() => setWireframe((current) => !current)}
          >
            <span>拓扑线框</span>
            <strong>{wireframe ? 'ON' : 'OFF'}</strong>
          </button>

          <div className="topology-stats">
            <div>
              <span>Sections</span>
              <strong>{stats.sections}</strong>
            </div>
            <div>
              <span>Rings</span>
              <strong>{stats.rings}</strong>
            </div>
            <div>
              <span>Vertices</span>
              <strong>{stats.vertices}</strong>
            </div>
            <div>
              <span>Triangles</span>
              <strong>{stats.triangles}</strong>
            </div>
          </div>

          <div className="architecture-note">
            <span>当前验证</span>
            <strong>Parameters → Blueprint → Rings → 1 Mesh</strong>
            <p>
              已移除 Sphere / Cylinder 人体拼接。身体由语义 Section 与 Ring
              直接写入顶点和索引；肩、髋等分支关节暂未做 JointPatch 焊接。
            </p>
          </div>
        </aside>

        <section className="viewport-panel">
          <CharacterViewport
            parameters={parameters}
            wireframe={wireframe}
            onTopologyStats={setStats}
          />
          <div className="viewport-caption">
            <span>拖动旋转 · 滚轮缩放</span>
            <span>HumanTopologyBlueprint v1 · External mesh assets: 0</span>
          </div>
        </section>
      </section>
    </main>
  );
}
