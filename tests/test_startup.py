import runpy
import sys

from werkzeug.serving import WSGIRequestHandler


def _run_server_as_main(monkeypatch):
    """Execute server.py as if __name__ == '__main__', then clean up sys.modules."""
    calls = []
    monkeypatch.setattr("flask.Flask.run", lambda self, **kwargs: calls.append(kwargs))
    monkeypatch.setattr(WSGIRequestHandler, "version_string", WSGIRequestHandler.version_string)
    if "server" in sys.modules:
        del sys.modules["server"]
    runpy.run_module("server", run_name="__main__")
    return calls


# --- Startup Path Tests ---


def test_main_calls_app_run(monkeypatch):
    calls = _run_server_as_main(monkeypatch)
    assert len(calls) == 1


def test_main_binds_to_localhost(monkeypatch):
    calls = _run_server_as_main(monkeypatch)
    assert calls[0]["host"] == "127.0.0.1"


def test_main_binds_to_port_3000(monkeypatch):
    calls = _run_server_as_main(monkeypatch)
    assert calls[0]["port"] == 3000


def test_main_suppresses_werkzeug_version(monkeypatch):
    _run_server_as_main(monkeypatch)
    assert WSGIRequestHandler.version_string(None) == ""


# --- Import Safety Tests ---


def test_import_does_not_call_app_run(monkeypatch):
    calls = []
    monkeypatch.setattr("flask.Flask.run", lambda self, **kwargs: calls.append(kwargs))
    if "server" in sys.modules:
        del sys.modules["server"]
    runpy.run_module("server", run_name="server")
    assert len(calls) == 0
