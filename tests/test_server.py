import server

from flask import Flask
from server import app


# --- Happy Path Tests ---


def test_get_root_status_code(client):
    response = client.get("/")
    assert response.status_code == 200


def test_get_root_response_body(client):
    response = client.get("/")
    assert response.data == b"Hello, World!"


def test_get_root_content_type(client):
    response = client.get("/")
    assert response.content_type == "text/plain; charset=utf-8"


def test_get_evening_status_code(client):
    response = client.get("/evening")
    assert response.status_code == 200


def test_get_evening_response_body(client):
    response = client.get("/evening")
    assert response.data == b"Good evening"


def test_get_evening_content_type(client):
    response = client.get("/evening")
    assert response.content_type == "text/plain; charset=utf-8"


def test_post_evening_status_code(client):
    response = client.post("/evening")
    assert response.status_code == 201


def test_post_evening_response_body(client):
    response = client.post("/evening")
    assert response.data == b"Good evening"


def test_post_evening_content_type(client):
    response = client.post("/evening")
    assert response.content_type == "text/plain; charset=utf-8"


def test_get_morning_status_code(client):
    response = client.get("/morning")
    assert response.status_code == 200


def test_get_morning_response_body(client):
    response = client.get("/morning")
    assert response.data == b"Good morning"


def test_get_morning_content_type(client):
    response = client.get("/morning")
    assert response.content_type == "text/plain; charset=utf-8"


def test_post_morning_status_code(client):
    response = client.post("/morning")
    assert response.status_code == 201


def test_post_morning_response_body(client):
    response = client.post("/morning")
    assert response.data == b"Good morning"


def test_post_morning_content_type(client):
    response = client.post("/morning")
    assert response.content_type == "text/plain; charset=utf-8"


# --- Edge Case Tests ---


def test_evening_get_vs_post_status_differentiation(client):
    get_response = client.get("/evening")
    post_response = client.post("/evening")
    assert get_response.status_code == 200
    assert post_response.status_code == 201
    assert get_response.status_code != post_response.status_code


def test_morning_get_vs_post_status_differentiation(client):
    get_response = client.get("/morning")
    post_response = client.post("/morning")
    assert get_response.status_code == 200
    assert post_response.status_code == 201
    assert get_response.status_code != post_response.status_code


# --- Error Case Tests: 404 Not Found ---


def test_unknown_route_returns_404(client):
    response = client.get("/nonexistent")
    assert response.status_code == 404


def test_post_unknown_route_returns_404(client):
    response = client.post("/nonexistent")
    assert response.status_code == 404


# --- Error Case Tests: 405 Method Not Allowed ---


def test_post_root_not_allowed(client):
    response = client.post("/")
    assert response.status_code == 405


def test_unsupported_method_on_evening(client):
    response = client.delete("/evening")
    assert response.status_code == 405


def test_unsupported_method_on_morning(client):
    response = client.delete("/morning")
    assert response.status_code == 405


# --- Application Importability Tests ---


def test_app_is_flask_instance():
    assert isinstance(app, Flask)


def test_app_import_does_not_start_server():
    assert hasattr(server, "app")
