"""将指定视频片段的 MediaPipe 姿态转换为网页人物动作源。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from scipy.ndimage import median_filter
from scipy.spatial.transform import Rotation, Slerp


LANDMARK_COUNT = 33
SAMPLE_NAMES = [
    "", "Hips", "Spine", "Spine2", "Neck", "Head", "RightShoulder",
    "RightArm", "RightForeArm", "RightHand", "LeftShoulder", "LeftArm",
    "LeftForeArm", "LeftHand", "RightUpLeg", "RightLeg", "RightFoot",
    "LeftUpLeg", "LeftLeg", "LeftFoot", "HeadTop_End", "RightHandMiddle1",
    "LeftHandMiddle1", "RightToeBase", "LeftToeBase",
]
SAMPLE_PARENTS = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 1, 14, 15, 1, 17, 18, 5, 9, 13, 16, 19]
CALIBRATION_CHILD = [-1, 2, 3, 4, 5, 20, 7, 8, 9, 21, 11, 12, 13, 22, 15, 16, 23, 18, 19, 24]
BIND = np.array([
    [0, 0, 0], [0, .929, 0], [0, 1.07, 0], [0, 1.24, 0],
    [0, 1.457, 0], [0, 1.52, 0], [.08, 1.36, 0], [.211, 1.365, 0],
    [.394, 1.101, 0], [.503, .912, .014], [-.08, 1.36, 0],
    [-.211, 1.365, 0], [-.394, 1.101, 0], [-.503, .912, .014],
    [.101, .929, 0], [.101, .52, 0], [.101, .105, 0],
    [-.101, .929, 0], [-.101, .52, 0], [-.101, .105, 0],
    [0, 1.72, 0], [.55, .85, .04], [-.55, .85, .04],
    [.101, .04, .15], [-.101, .04, .15],
], dtype=np.float64)
CRITICAL = (11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)
SEGMENTS = ((11, 13), (13, 15), (12, 14), (14, 16), (23, 25), (25, 27), (24, 26), (26, 28))
POSE_CONNECTIONS = ((11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21),
                    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22),
                    (11, 23), (12, 24), (23, 24), (23, 25), (25, 27),
                    (27, 29), (29, 31), (24, 26), (26, 28), (28, 30), (30, 32))
FOREARM_BLEND_WEIGHTS = np.linspace(0., 1., 17)
FOREARM_MAX_STEP_DEGREES = 89.
FOREARM_MAX_EXCESS_DEGREES = 35.


def unit(vector: np.ndarray, fallback: np.ndarray) -> np.ndarray:
    length = float(np.linalg.norm(vector))
    return vector / length if length > 1e-6 else fallback.copy()


def basis(primary: np.ndarray, forward: np.ndarray) -> np.ndarray:
    y_axis = unit(primary, np.array([0., 1., 0.]))
    projected = forward - y_axis * np.dot(forward, y_axis)
    if np.linalg.norm(projected) < 1e-6:
        candidate = np.array([0., 0., 1.]) if abs(y_axis[2]) < .9 else np.array([1., 0., 0.])
        projected = candidate - y_axis * np.dot(candidate, y_axis)
    z_axis = unit(projected, np.array([0., 0., 1.]))
    x_axis = unit(np.cross(y_axis, z_axis), np.array([1., 0., 0.]))
    z_axis = unit(np.cross(x_axis, y_axis), np.array([0., 0., 1.]))
    return np.column_stack((x_axis, y_axis, z_axis))


def swing_rotation(source: np.ndarray, target: np.ndarray) -> np.ndarray:
    """仅用可观察的骨段方向求旋转，不凭空推断肢体轴向扭转。"""
    start = unit(source, np.array([0., 1., 0.]))
    end = unit(target, start)
    dot = float(np.clip(np.dot(start, end), -1, 1))
    if dot < -.9999:
        axis = unit(np.cross(start, np.array([0., 0., 1.])), np.array([1., 0., 0.]))
        return np.array([*axis, 0.])
    cross = np.cross(start, end)
    quaternion = np.array([cross[0], cross[1], cross[2], 1 + dot])
    return quaternion / np.linalg.norm(quaternion)


def foot_rotation(bind_direction: np.ndarray, observed: np.ndarray, torso_forward: np.ndarray,
                  previous_angles: np.ndarray | None) -> tuple[np.ndarray, np.ndarray]:
    """脚踝到脚尖决定脚骨方向，限制单目深度噪声造成的鞋尖翘起或下扎。"""
    facing = unit(torso_forward * np.array([1., 0., 1.]), np.array([0., 0., 1.]))
    horizontal = observed * np.array([1., 0., 1.])
    horizontal = unit(horizontal, facing)
    yaw = np.arctan2(np.cross(facing, horizontal)[1], np.dot(facing, horizontal))
    # 单目脚尖深度会让两只鞋分别卡在相反边界；保留小幅外八字，避免鞋横向落地。
    yaw = float(np.clip(yaw, -np.deg2rad(15), np.deg2rad(15)))
    pitch = float(np.clip(np.arctan2(observed[1], np.linalg.norm(observed[[0, 2]])),
                          -np.deg2rad(40), -np.deg2rad(18)))
    if previous_angles is not None:
        yaw = float(np.clip(yaw, previous_angles[0] - np.deg2rad(8), previous_angles[0] + np.deg2rad(8)))
        pitch = float(np.clip(pitch, previous_angles[1] - np.deg2rad(8), previous_angles[1] + np.deg2rad(8)))
    facing = Rotation.from_rotvec(np.array([0., yaw, 0.])).apply(facing)
    direction = facing * np.cos(pitch) + np.array([0., np.sin(pitch), 0.])

    def frame(forward: np.ndarray) -> np.ndarray:
        z_axis = unit(forward, np.array([0., 0., 1.]))
        x_axis = unit(np.cross(np.array([0., 1., 0.]), z_axis), np.array([1., 0., 0.]))
        y_axis = unit(np.cross(z_axis, x_axis), np.array([0., 1., 0.]))
        return np.column_stack((x_axis, y_axis, z_axis))

    return Rotation.from_matrix(frame(direction) @ frame(bind_direction).T).as_quat(), np.array([yaw, pitch])


def semantic_points(points: np.ndarray) -> np.ndarray:
    left_hip, right_hip = points[23], points[24]
    hips = (left_hip + right_hip) / 2
    shoulders = (points[11] + points[12]) / 2
    ears = (points[7] + points[8]) / 2
    head = (ears + points[0]) / 2
    height = float(np.linalg.norm(shoulders - hips))
    up = unit(shoulders - hips, np.array([0., 1., 0.]))
    semantic = np.array([
        [0, 0, 0], hips, hips + .34 * (shoulders - hips),
        hips + .78 * (shoulders - hips), shoulders + .12 * (head - shoulders),
        head, shoulders + .22 * (points[12] - shoulders), points[12],
        points[14], points[16], shoulders + .22 * (points[11] - shoulders),
        points[11], points[13], points[15], points[24], points[26],
        points[28], points[23], points[25], points[27],
        head + up * (.28 * height), points[20], points[19], points[32], points[31],
    ], dtype=np.float64)
    semantic -= hips
    semantic[0] = 0
    return semantic


def repair_isolated_spikes(points: np.ndarray) -> tuple[np.ndarray, list[dict]]:
    """仅修复邻帧能够证明是孤立回跳的点；低置信度本身不改写。"""
    cleaned = points.copy()
    repairs: list[dict] = []
    for frame in range(1, len(points) - 1):
        for landmark in range(LANDMARK_COUNT):
            before, current, after = points[frame - 1:frame + 2, landmark, :3]
            if not np.isfinite(np.stack((before, current, after))).all():
                continue
            if np.linalg.norm(current - before) > .3 and np.linalg.norm(current - after) > .3 and np.linalg.norm(before - after) < .15:
                cleaned[frame, landmark, :3] = (before + after) / 2
                repairs.append({"frame": frame, "landmark": landmark, "reason": "isolated_world_jump"})
    return cleaned, repairs


def validate_input(normalized: np.ndarray, world: np.ndarray, timestamps: np.ndarray) -> None:
    if normalized.shape != world.shape or normalized.ndim != 3 or normalized.shape[1:] != (LANDMARK_COUNT, 5):
        raise ValueError("原始骨架形状必须为 (帧数, 33, 5)")
    if len(timestamps) != len(world) or np.any(np.diff(timestamps) <= 0):
        raise ValueError("时间戳必须严格递增")
    if len(timestamps) < 2:
        raise ValueError("片段至少需要两个视频帧")


def missing_intervals(valid: np.ndarray) -> list[dict]:
    intervals = []
    start = None
    for frame, present in enumerate(np.r_[valid, True]):
        if not present and start is None:
            start = frame
        elif present and start is not None:
            intervals.append({"startFrame": start, "endFrame": frame - 1, "length": frame - start})
            start = None
    return intervals


def fill_missing_for_derived(points: np.ndarray) -> tuple[np.ndarray, list[dict]]:
    """仅为派生动画补齐坐标；原始 NPZ 和来源有效位不变。"""
    cleaned = points.copy()
    repairs = []
    for landmark in range(LANDMARK_COUNT):
        valid = np.isfinite(points[:, landmark, :3]).all(axis=1)
        if not valid.any():
            raise ValueError(f"Landmark {landmark} 全片缺失，不能建立派生动画")
        for interval in missing_intervals(valid):
            start, end = interval["startFrame"], interval["endFrame"]
            previous = start - 1 if start else None
            following = end + 1 if end + 1 < len(points) else None
            method = "interpolate" if interval["length"] <= 3 and previous is not None and following is not None else "hold"
            for frame in range(start, end + 1):
                if method == "interpolate":
                    alpha = (frame - previous) / (following - previous)
                    cleaned[frame, landmark, :3] = (1 - alpha) * points[previous, landmark, :3] + alpha * points[following, landmark, :3]
                else:
                    reference = previous if previous is not None else following
                    cleaned[frame, landmark, :3] = points[reference, landmark, :3]
            repairs.append({"landmark": landmark, **interval, "method": method})
    return cleaned, repairs


def build_motion(pose_path: Path, metadata_path: Path, video_path: Path,
                 motion_id: str, clip_name: str, start_seconds: float,
                 end_seconds: float | None) -> tuple[dict, dict]:
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if Path(metadata["source_video"]).resolve() != video_path.resolve():
        raise ValueError("提取元数据记录的原视频路径与当前视频不一致")
    video_sha = hashlib.sha256(video_path.read_bytes()).hexdigest()
    pose_sha = hashlib.sha256(pose_path.read_bytes()).hexdigest()
    recorded_video_sha = metadata.get("source_video_sha256")
    recorded_pose_sha = metadata.get("pose_sha256")
    if (recorded_video_sha is None) != (recorded_pose_sha is None):
        raise ValueError("提取元数据中的原视频和姿态文件哈希必须同时存在")
    if recorded_video_sha is not None and (recorded_video_sha != video_sha or recorded_pose_sha != pose_sha):
        raise ValueError("原视频或完整姿态文件的 SHA-256 与提取元数据不一致")
    model_path = Path(metadata["model_path"])
    if hashlib.sha256(model_path.read_bytes()).hexdigest() != metadata["model_sha256"]:
        raise ValueError("MediaPipe 模型的 SHA-256 与提取元数据不一致")
    with np.load(pose_path, allow_pickle=False) as saved:
        normalized_all = saved["normalized_landmarks"]
        world_all = saved["world_landmarks"]
        timestamp_all = saved["timestamp_ms"]
    actual_end = float(metadata["duration_seconds"]) if end_seconds is None else end_seconds
    if not 0 <= start_seconds < actual_end <= float(metadata["duration_seconds"]) + .05:
        raise ValueError("片段起止时间超出视频范围")
    selected = (timestamp_all >= round(start_seconds * 1000)) & (timestamp_all <= round(actual_end * 1000))
    normalized = normalized_all[selected]
    world = world_all[selected]
    timestamps = timestamp_all[selected]
    validate_input(normalized, world, timestamps)
    frame_valid = np.isfinite(world[:, CRITICAL, :3]).all(axis=(1, 2))
    critical_gaps = missing_intervals(frame_valid)
    missing_count = int(np.count_nonzero(~frame_valid))
    if missing_count > len(world) * .05 or any(gap["length"] > 15 for gap in critical_gaps):
        raise ValueError(f"关键姿态缺失 {missing_count}/{len(world)} 帧；连续区间 {critical_gaps}，超过候选发布门槛")
    raw_world = world.copy()
    filled, missing_repairs = fill_missing_for_derived(world)
    cleaned, repairs = repair_isolated_spikes(filled)
    # 手腕和脚尖的单帧深度抖动会放大为骨骼翻转；仅对派生数据做短窗中值处理。
    cleaned[:, :, :3] = median_filter(cleaned[:, :, :3], size=(5, 1, 1), mode="nearest")
    # MediaPipe 相机坐标转为网页人物的 +X 右、+Y 上、+Z 前。
    positions_world = cleaned[:, :, :3].astype(np.float64) * np.array([-1., -1., -1.])
    hip_to_ankle = np.mean(positions_world[:, [23, 24], 1], axis=1) - np.mean(positions_world[:, [27, 28], 1], axis=1)
    height = float(np.median(hip_to_ankle[hip_to_ankle > .1]))
    if not .4 < height < 1.8:
        raise ValueError(f"推定髋踝高度不可信：{height:.3f}m")
    scale = .824 / height
    points = positions_world * scale
    source_positions = np.empty((len(points), 25, 3), dtype=np.float64)
    world_deltas = np.empty((len(points), 20, 4), dtype=np.float64)
    previous = np.tile(np.array([0., 0., 0., 1.]), (20, 1))
    previous_directions = np.zeros((20, 3), dtype=np.float64)
    previous_foot_angles: dict[int, np.ndarray] = {}
    foot_pitch_clamp_frames = {16: {"tooSteep": 0, "tooShallow": 0},
                               19: {"tooSteep": 0, "tooShallow": 0}}
    previous_torso_forward: np.ndarray | None = None
    torso_forward_corrections: list[int] = []
    limited_rotations: list[dict] = []
    bind_bases = [basis(BIND[CALIBRATION_CHILD[index]] - BIND[index], np.array([0., 0., 1.])) if index else np.eye(3) for index in range(20)]
    for frame, frame_points in enumerate(points):
        semantic = semantic_points(frame_points)
        semantic[:, 1] += .929
        semantic[0] = 0
        source_positions[frame] = semantic
        torso_right = unit(frame_points[24] - frame_points[23] + frame_points[12] - frame_points[11], np.array([1., 0., 0.]))
        torso_up = unit((frame_points[11] + frame_points[12]) / 2 - (frame_points[23] + frame_points[24]) / 2, np.array([0., 1., 0.]))
        torso_forward = unit(np.cross(torso_right, torso_up), np.array([0., 0., 1.]))
        if previous_torso_forward is not None and np.dot(torso_forward, previous_torso_forward) < 0:
            torso_forward = -torso_forward
            torso_forward_corrections.append(frame)
        previous_torso_forward = torso_forward
        world_deltas[frame, 0] = [0, 0, 0, 1]
        for bone in range(1, 20):
            child = CALIBRATION_CHILD[bone]
            if bone in (9, 13):
                rotation = world_deltas[frame, bone - 1].copy()
            elif bone == 5:
                rotation = world_deltas[frame, 4].copy()
            elif bone <= 4:
                # 肩到脸的关键点会使头长期低垂；颈和头只跟随躯干水平朝向。
                primary = np.array([0., 1., 0.]) if bone == 4 else semantic[child] - semantic[bone]
                forward = unit(torso_forward * np.array([1., 0., 1.]), np.array([0., 0., 1.])) if bone == 4 else torso_forward
                pose_basis = basis(primary, forward)
                rotation = Rotation.from_matrix(pose_basis @ bind_bases[bone].T).as_quat()
            else:
                observed = unit(semantic[child] - semantic[bone], np.array([0., 1., 0.]))
                if bone in (16, 19):
                    observed_pitch = np.rad2deg(np.arctan2(observed[1], np.linalg.norm(observed[[0, 2]])))
                    if observed_pitch < -40:
                        foot_pitch_clamp_frames[bone]["tooSteep"] += 1
                    elif observed_pitch > -18:
                        foot_pitch_clamp_frames[bone]["tooShallow"] += 1
                    rotation, previous_foot_angles[bone] = foot_rotation(
                        BIND[child] - BIND[bone], observed, torso_forward,
                        previous_foot_angles.get(bone))
                elif bone in (8, 12):
                    # 前臂沿上臂姿态做最短方向旋转，避免两段各自估计轴向时在肘部反向扭结。
                    upper_direction = unit(semantic[bone] - semantic[bone - 1], observed)
                    upper_rotation = Rotation.from_quat(world_deltas[frame, bone - 1])
                    upper_frame = upper_rotation * Rotation.from_matrix(bind_bases[bone - 1])
                    forearm_frame = Rotation.from_quat(swing_rotation(upper_direction, observed)) * upper_frame
                    rotation = (forearm_frame * Rotation.from_matrix(bind_bases[bone]).inv()).as_quat()
                    if frame:
                        # 两种姿态都指向同一肘腕方向；在相邻帧连续性与上臂轴向之间选最小必要校正。
                        previous_rotation = Rotation.from_quat(previous[bone])
                        temporal = Rotation.from_quat(swing_rotation(previous_directions[bone], observed)) * previous_rotation
                        candidates = Slerp([0, 1], Rotation.from_quat([temporal.as_quat(), rotation]))(FOREARM_BLEND_WEIGHTS)
                        bend_degrees = np.rad2deg(np.arccos(np.clip(np.dot(upper_direction, observed), -1, 1)))
                        chosen = None
                        best = None
                        best_excess = float("inf")
                        for candidate in candidates:
                            step_degrees = np.rad2deg((candidate * previous_rotation.inv()).magnitude())
                            if step_degrees > FOREARM_MAX_STEP_DEGREES:
                                continue
                            excess = np.rad2deg((candidate * upper_rotation.inv()).magnitude()) - bend_degrees
                            if excess <= FOREARM_MAX_EXCESS_DEGREES:
                                chosen = candidate
                                break
                            if excess < best_excess:
                                best, best_excess = candidate, excess
                        rotation = (chosen if chosen is not None else best if best is not None else temporal).as_quat()
                    previous_directions[bone] = observed
                elif bone in (7, 11):
                    # 上臂用连续骨段方向保持动作，再缓慢校正衣袖轴向。
                    if frame == 0:
                        rotation = swing_rotation(BIND[child] - BIND[bone], observed)
                    else:
                        incremental = swing_rotation(previous_directions[bone], observed)
                        transported = Rotation.from_quat(incremental) * Rotation.from_quat(previous[bone])
                        projection = torso_forward - observed * np.dot(torso_forward, observed)
                        if np.linalg.norm(projection) > .25:
                            target_basis = basis(observed, torso_forward)
                            target = Rotation.from_matrix(target_basis @ bind_bases[bone].T)
                            correction = (target * transported.inv()).as_rotvec()
                            correction_length = np.linalg.norm(correction)
                            if correction_length > np.deg2rad(3):
                                correction *= np.deg2rad(3) / correction_length
                            transported = Rotation.from_rotvec(correction) * transported
                        rotation = transported.as_quat()
                    previous_directions[bone] = observed
                else:
                    # 逐帧从绑定方向求最短旋转，避免沿时间累计不可观测的轴向扭转。
                    rotation = swing_rotation(BIND[child] - BIND[bone], observed)
            if frame:
                previous_rotation = Rotation.from_quat(previous[bone])
                change = (Rotation.from_quat(rotation) * previous_rotation.inv()).as_rotvec()
                degrees = float(np.rad2deg(np.linalg.norm(change)))
                maximum_step_degrees = FOREARM_MAX_STEP_DEGREES if bone in (8, 12) else 75
                if degrees > maximum_step_degrees:
                    rotation = (Rotation.from_rotvec(change * (maximum_step_degrees / degrees)) * previous_rotation).as_quat()
                    limited_rotations.append({"frame": frame, "bone": bone, "observedDegrees": round(degrees, 2), "limitedDegrees": maximum_step_degrees})
            if np.dot(rotation, previous[bone]) < 0:
                rotation = -rotation
            world_deltas[frame, bone] = rotation
            previous[bone] = rotation
    # 对照视图使用未经清理的 33 点，仅做坐标变换和固定高度偏移。
    display = raw_world[:, :, :3].astype(np.float64) * np.array([-1., -1., -1.]) * scale
    display[:, :, 1] += .929
    point_valid = np.isfinite(raw_world[:, :, :3]).all(axis=2)
    display = np.nan_to_num(display, nan=0.0, posinf=0.0, neginf=0.0)
    times = (timestamps - timestamps[0]).astype(np.float64) / 1000
    def rounded(values: np.ndarray, digits: int = 6) -> list:
        return np.round(values, digits).reshape(-1).tolist()
    motion = {
        "schema": 1, "id": motion_id,
        "source": {
            "provider": "MediaPipe", "format": "mp4", "profile": "pose-landmarker-heavy-v1",
            "file": video_path.name, "sha256": video_sha, "clipName": clip_name,
            "uniqueBones": 20, "rawBoneNodes": 33, "tracks": 21, "threeVersion": "0.180.0",
            "axisConversion": "MediaPipe camera coordinates → +X right / +Y up / +Z forward",
            "extractorVersion": "mediapipe-pose-clip-v6", "generator": "MediaPipe 1.0.1 / scipy",
            "modelSha256": metadata["model_sha256"], "poseSha256": pose_sha,
            "sourceStartSeconds": start_seconds, "sourceEndSeconds": actual_end,
        },
        "duration": float(times[-1]), "fps": float(metadata["fps"]), "times": rounded(times, 6),
        "names": SAMPLE_NAMES, "parents": SAMPLE_PARENTS,
        "bindPositions": rounded(BIND), "worldDeltas": rounded(world_deltas, 8),
        "positions": rounded(source_positions),
        "mediapipe33": {
            "positions": rounded(display),
            "visibility": rounded(np.clip(np.nan_to_num(raw_world[:, :, 3], nan=0.0, posinf=0.0, neginf=0.0), 0, 1), 4),
            "validity": point_valid.astype(np.uint8).reshape(-1).tolist(),
            "connections": POSE_CONNECTIONS,
        },
    }
    report = {
        "schema": "wanhu-mediapipe-clip-diagnostics-v1", "source": video_path.name,
        "videoSha256": video_sha, "poseSha256": pose_sha, "modelSha256": metadata["model_sha256"],
        "sourceStartSeconds": start_seconds, "sourceEndSeconds": actual_end, "frameCount": len(points),
        "missingCriticalFrames": missing_count, "missingCriticalIntervals": critical_gaps,
        "filledDerivedIntervals": missing_repairs,
        "limitedRotations": limited_rotations,
        "torsoForwardCorrections": torso_forward_corrections,
        "footPitchClampFrames": {"right": foot_pitch_clamp_frames[16], "left": foot_pitch_clamp_frames[19]},
        "lowVisibilityFrames": int(np.count_nonzero(~np.all(normalized[:, CRITICAL, 3] >= .5, axis=1))),
        "confidencePolicy": "低置信度仅作标记；坐标连续时照常使用",
        "derivedRotationPolicy": "上臂轴向缓慢校正，前臂在时间连续性与上臂轴向之间选择同向姿态；前臂单帧旋转不超过 89°，其余骨骼不超过 75°；头颈沿躯干水平朝向；脚踝到脚尖决定脚骨方向，俯仰限于 -40° 至 -18°、相对躯干偏航限于 15°，并保持鞋面朝上",
        "repairedPoints": repairs,
        "remainingLimitations": ["MediaPipe world 坐标逐帧以髋部为原点；不推断真实世界水平位移", "头部只跟随躯干水平朝向，不补造独立头部动作", "脚掌方向含视觉约束，不代表真实脚掌姿态", "遮挡时 world 深度可能不准确"],
    }
    return motion, report


def preserve_non_foot_tracks(motion: dict, report: dict, existing_path: Path) -> None:
    """旧条目只替换脚骨，避免重生成时改动已经审查过的其余骨骼。"""
    existing = json.loads(existing_path.read_text(encoding="utf-8"))
    for field in ("id", "times", "positions", "bindPositions"):
        if existing[field] != motion[field]:
            raise ValueError(f"旧动作的 {field} 与当前完整提取结果不一致")
    for field in ("sha256", "poseSha256", "modelSha256"):
        if existing["source"].get(field) != motion["source"].get(field):
            raise ValueError(f"旧动作的 {field} 来源哈希不一致")
    for field in ("positions", "visibility"):
        if existing["mediapipe33"][field] != motion["mediapipe33"][field]:
            raise ValueError(f"旧动作的原始 33 点 {field} 不一致")
    old_rotations = np.asarray(existing["worldDeltas"]).reshape(-1, 20, 4)
    new_rotations = np.asarray(motion["worldDeltas"]).reshape(-1, 20, 4)
    if old_rotations.shape != new_rotations.shape:
        raise ValueError("旧动作骨骼旋转数量与当前结果不一致")
    non_foot_bones = [bone for bone in range(20) if bone not in (16, 19)]
    new_rotations[:, non_foot_bones] = old_rotations[:, non_foot_bones]
    motion["worldDeltas"] = new_rotations.reshape(-1).tolist()
    previous_version = existing["source"].get("nonFootExtractorVersion", existing["source"]["extractorVersion"])
    motion["source"]["nonFootExtractorVersion"] = previous_version
    report["nonFootTracksPreservedFrom"] = previous_version
    report["derivedRotationPolicy"] += f"；其余骨骼沿用已审查的 {previous_version} 动作轨道"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pose", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--clip-id", required=True)
    parser.add_argument("--clip-name", required=True)
    parser.add_argument("--start-seconds", type=float, required=True)
    parser.add_argument("--end-seconds", type=float)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--preserve-non-foot-from", type=Path)
    arguments = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", arguments.clip_id):
        parser.error("clip-id 只能包含小写字母、数字与连字符")
    motion, report = build_motion(arguments.pose, arguments.metadata, arguments.video,
                                  arguments.clip_id, arguments.clip_name,
                                  arguments.start_seconds, arguments.end_seconds)
    if arguments.preserve_non_foot_from is not None:
        preserve_non_foot_tracks(motion, report, arguments.preserve_non_foot_from)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.report.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(motion, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    arguments.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"生成 {report['frameCount']} 帧；低置信度帧 {report['lowVisibilityFrames']}；局部修复点 {len(report['repairedPoints'])}")


if __name__ == "__main__":
    main()
