from __future__ import annotations

import argparse

from model_controller import Model, ModelController


def build_demo_model() -> ModelController:
    controller = ModelController()
    a = controller.add_vertex(-1, -1, -1)
    b = controller.add_vertex(1, -1, -1)
    c = controller.add_vertex(1, 1, -1)
    d = controller.add_vertex(-1, 1, -1)
    e = controller.add_vertex(-1, -1, 1)
    f = controller.add_vertex(1, -1, 1)
    g = controller.add_vertex(1, 1, 1)
    h = controller.add_vertex(-1, 1, 1)

    controller.add_face(a, b, c, d)
    controller.add_face(e, f, g, h)
    controller.add_face(a, b, f, e)
    controller.add_face(b, c, g, f)
    controller.add_face(c, d, h, g)
    controller.add_face(d, a, e, h)
    return controller


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="3D Model Controller demo")
    parser.add_argument("--demo", action="store_true", help="run the built-in 3D demo")
    parser.add_argument("--obj", type=str, help="OBJ file to load and inspect")
    parser.add_argument("--save", type=str, help="save the current model to a path")
    parser.add_argument("--rotate-x", type=float, default=0.0, help="rotation around the X axis")
    parser.add_argument("--rotate-y", type=float, default=0.0, help="rotation around the Y axis")
    parser.add_argument("--rotate-z", type=float, default=0.0, help="rotation around the Z axis")
    parser.add_argument("--translate-x", type=float, default=0.0, help="translation along X")
    parser.add_argument("--translate-y", type=float, default=0.0, help="translation along Y")
    parser.add_argument("--translate-z", type=float, default=0.0, help="translation along Z")
    parser.add_argument("--scale", type=float, default=1.0, help="uniform scaling")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.obj:
        controller = ModelController.from_obj(args.obj)
    else:
        controller = build_demo_model()

    controller.rotate(x=args.rotate_x, y=args.rotate_y, z=args.rotate_z)
    controller.translate(x=args.translate_x, y=args.translate_y, z=args.translate_z)
    if args.scale != 1.0:
        controller.scale_model(args.scale)

    if args.save:
        controller.save_obj(args.save)

    if args.demo or not args.obj:
        transformed = controller.get_transformed_vertices()
        print("Transformed vertices:")
        for index, vertex in enumerate(transformed):
            print(f"  {index}: {vertex}")
        print("Projected 2D:")
        for point in controller.project_2d():
            print(f"  {point}")
        return

    print(controller.snapshot())


if __name__ == "__main__":
    main()
