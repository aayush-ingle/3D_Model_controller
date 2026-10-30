from model_controller import Model, ModelController


def test_model_add_vertex_and_face():
    model = Model()
    idx = model.add_vertex(1, 2, 3)
    assert idx == 0
    model.add_face(0, 1, 2)
    assert model.vertices == [(1.0, 2.0, 3.0)]
    assert model.faces == [(0, 1, 2)]


def test_model_transform_rotation_and_translation():
    model = Model(vertices=[(1.0, 0.0, 0.0)])
    transformed = model.transform(translation=(2.0, 3.0, 4.0), rotation=(0.0, 90.0, 0.0), scale=1.0)
    assert transformed[0][0] == 2.0
    assert transformed[0][1] == 3.0
    assert transformed[0][2] == 4.0 + 1.0 * -1.0


def test_controller_snapshot_and_projection():
    controller = ModelController()
    controller.add_vertex(0, 0, 0)
    controller.add_vertex(1, 0, 0)
    controller.add_face(0, 1)
    snapshot = controller.snapshot()
    assert snapshot["faces"] == [(0, 1)]
    assert len(controller.project_2d()) == 2


def test_obj_round_trip(tmp_path):
    obj_path = tmp_path / "model.obj"
    controller = ModelController()
    a = controller.add_vertex(0, 0, 0)
    b = controller.add_vertex(1, 0, 0)
    c = controller.add_vertex(0, 1, 0)
    controller.add_face(a, b, c)
    controller.save_obj(obj_path)

    loaded = ModelController.from_obj(obj_path)
    assert loaded.model.vertices == [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
    assert loaded.model.faces == [(0, 1, 2)]
