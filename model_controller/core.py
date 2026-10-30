from __future__ import annotations

from dataclasses import dataclass, field
from math import cos, radians, sin
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

Vec3 = Tuple[float, float, float]


@dataclass(frozen=True)
class Vertex:
    x: float
    y: float
    z: float

    def to_tuple(self) -> Vec3:
        return (self.x, self.y, self.z)


@dataclass
class Model:
    vertices: List[Vec3] = field(default_factory=list)
    faces: List[Tuple[int, ...]] = field(default_factory=list)

    def add_vertex(self, x: float, y: float, z: float) -> int:
        self.vertices.append((float(x), float(y), float(z)))
        return len(self.vertices) - 1

    def add_face(self, *indices: int) -> None:
        self.faces.append(tuple(indices))

    def transform(self, translation: Vec3 = (0.0, 0.0, 0.0), rotation: Vec3 = (0.0, 0.0, 0.0), scale: float = 1.0) -> List[Vec3]:
        transformed: List[Vec3] = []
        rotation_x, rotation_y, rotation_z = rotation

        for x, y, z in self.vertices:
            x, y, z = x * scale, y * scale, z * scale

            xr = radians(rotation_x)
            yr = radians(rotation_y)
            zr = radians(rotation_z)

            # Rotate around X axis
            y, z = y * cos(xr) - z * sin(xr), y * sin(xr) + z * cos(xr)
            # Rotate around Y axis
            x, z = x * cos(yr) + z * sin(yr), -x * sin(yr) + z * cos(yr)
            # Rotate around Z axis
            x, y = x * cos(zr) - y * sin(zr), x * sin(zr) + y * cos(zr)

            tx, ty, tz = translation
            transformed.append((x + tx, y + ty, z + tz))

        return transformed

    @classmethod
    def from_obj(cls, path: str | Path) -> "Model":
        model = cls()
        path = Path(path)
        with path.open("r", encoding="utf-8") as obj_file:
            for line in obj_file:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                if stripped.startswith("v "):
                    parts = stripped.split()
                    if len(parts) < 4:
                        raise ValueError(f"Invalid vertex in OBJ: {stripped}")
                    model.vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
                elif stripped.startswith("f "):
                    parts = stripped.split()[1:]
                    if not parts:
                        continue
                    face = []
                    for part in parts:
                        vertex_id = part.split("/")[0]
                        if vertex_id:
                            face.append(int(vertex_id) - 1)
                    if face:
                        model.faces.append(tuple(face))
        return model

    def save_obj(self, path: str | Path) -> None:
        path = Path(path)
        with path.open("w", encoding="utf-8") as obj_file:
            for x, y, z in self.vertices:
                obj_file.write(f"v {x} {y} {z}\n")
            for face in self.faces:
                obj_file.write("f " + " ".join(str(index + 1) for index in face) + "\n")


class ModelController:
    def __init__(self, model: Model | None = None):
        self.model = model or Model()
        self.rotation = (0.0, 0.0, 0.0)
        self.position = (0.0, 0.0, 0.0)
        self.scale = 1.0

    def add_vertex(self, x: float, y: float, z: float) -> int:
        return self.model.add_vertex(x, y, z)

    def add_face(self, *indices: int) -> None:
        self.model.add_face(*indices)

    def rotate(self, x: float = 0.0, y: float = 0.0, z: float = 0.0) -> "ModelController":
        self.rotation = (self.rotation[0] + x, self.rotation[1] + y, self.rotation[2] + z)
        return self

    def translate(self, x: float = 0.0, y: float = 0.0, z: float = 0.0) -> "ModelController":
        tx, ty, tz = self.position
        self.position = (tx + x, ty + y, tz + z)
        return self

    def scale_model(self, factor: float) -> "ModelController":
        self.scale *= factor
        return self

    def get_transformed_vertices(self) -> List[Vec3]:
        return self.model.transform(translation=self.position, rotation=self.rotation, scale=self.scale)

    def project_2d(self, camera_distance: float = 5.0, focal_length: float = 1.0) -> List[Tuple[float, float]]:
        projected: List[Tuple[float, float]] = []
        for x, y, z in self.get_transformed_vertices():
            z_normalized = z + camera_distance
            if abs(z_normalized) < 1e-9:
                z_normalized = 1e-9
            projected_x = (x * focal_length) / z_normalized
            projected_y = (y * focal_length) / z_normalized
            projected.append((projected_x, projected_y))
        return projected

    def snapshot(self) -> dict:
        return {
            "rotation": self.rotation,
            "position": self.position,
            "scale": self.scale,
            "vertices": self.get_transformed_vertices(),
            "faces": self.model.faces,
        }

    def load_obj(self, path: str | Path) -> "ModelController":
        self.model = Model.from_obj(path)
        return self

    def save_obj(self, path: str | Path) -> None:
        self.model.save_obj(path)

    @classmethod
    def from_obj(cls, path: str | Path) -> "ModelController":
        return cls(Model.from_obj(path))


__all__ = ["Vec3", "Vertex", "Model", "ModelController"]
