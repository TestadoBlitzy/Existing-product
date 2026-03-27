import runpy
import sys

from werkzeug.serving import WSGIRequestHandler


def _run_server_as_main(monkeypatch):
    """Flush server from sys.modules cache and execute server.py as __main__."""
    calls = []
    # Patch Flask.run at CLASS level (not instance) because runpy.run_module creates
    # a new Flask app instance — an instance-level patch on server.app would miss the call.
    monkeypatch.setattr("flask.Flask.run", lambda self, **kwargs: calls.append(kwargs))
    # Save the original WSGIRequestHandler.version_string via monkeypatch so it is
    # auto-reverted after the test, even though the __main__ block mutates it directly.
    monkeypatch.setattr(WSGIRequestHandler, "version_string", WSGIRequestHandler.version_string)
    monkeypatch.delitem(sys.modules, "server", raising=False)
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
    monkeypatch.delitem(sys.modules, "server", raising=False)
    runpy.run_module("server", run_name="server")
    assert len(calls) == 0
