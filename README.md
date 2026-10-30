# 3D Model Controller

This project provides a lightweight 3D model controller and transformation toolkit for simple mesh data.

## Features

- Create 3D models from vertices and faces
- Rotate, translate, and scale meshes
- Export/import OBJ files
- Project a 3D model into 2D for simple visualization
- Run a small command-line demo

## Quick start

```bash
python app.py --demo
```

To load a model from an OBJ file:

```bash
python app.py --obj path/to/model.obj
```

## Example usage

```python
from model_controller import Model, ModelController

controller = ModelController()
controller.add_vertex(0, 0, 0)
controller.add_vertex(1, 0, 0)
controller.add_vertex(0, 1, 0)
controller.add_face(0, 1, 2)
controller.rotate(y=45)
print(controller.snapshot())
```
