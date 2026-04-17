"""Import safety, configuration, and startup behavior tests for app.py.

Validates that:
- Importing the ``app`` module does not trigger server startup
- Configuration constants HOST, PORT, and METHODS match documented values
- The Flask application instance has the expected identity and type
- The ``if __name__ == '__main__'`` guard correctly invokes ``app.run()``
  with the configured host and port

These tests cover the non-HTTP behavioral requirements of app.py.  They
do NOT use the ``client`` fixture from conftest.py — all verification is
performed via direct module-level imports and ``unittest.mock`` patching.
"""

import runpy
from unittest.mock import patch

import app
from flask import Flask


# ---------------------------------------------------------------------------
# Import Safety Tests
# ---------------------------------------------------------------------------


def test_import_app_does_not_start_server():
    """Importing app exposes the Flask instance without binding a port.

    The fact that this test (and every other test in the suite) runs
    successfully without binding TCP port 3000 implicitly proves that
    ``import app`` does not trigger server startup.  We additionally
    assert that the expected attributes are accessible.
    """
    assert hasattr(app, 'app'), "app module must expose an 'app' attribute"
    assert isinstance(app.app, Flask), "app.app must be a Flask instance"


def test_import_app_module_is_reentrant():
    """Re-importing app returns the cached module without side effects.

    Python's module caching (``sys.modules``) means the second
    ``import app`` returns the same module object.  This test confirms
    no reentrant initialisation side effects occur.
    """
    import app as app_reimport  # noqa: F811 — intentional re-import

    assert isinstance(app_reimport.app, Flask), (
        "Re-imported app.app must still be a Flask instance"
    )
    assert app_reimport is app, "Re-import must return the same cached module"


# ---------------------------------------------------------------------------
# Configuration Constant Tests
# ---------------------------------------------------------------------------


def test_host_constant_value():
    """HOST must be '127.0.0.1' — localhost-only binding."""
    assert app.HOST == '127.0.0.1'


def test_port_constant_value():
    """PORT must be 3000 — matches the original Node.js server.js port."""
    assert app.PORT == 3000


def test_methods_constant_contains_all_seven_methods():
    """METHODS must list all seven HTTP methods with correct count."""
    expected = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
    assert app.METHODS == expected
    assert len(app.METHODS) == 7


def test_methods_constant_exact_order():
    """METHODS must preserve the documented order exactly."""
    assert app.METHODS == [
        'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS',
    ]


def test_host_is_string():
    """HOST must be a str type."""
    assert isinstance(app.HOST, str)


def test_port_is_integer():
    """PORT must be an int type."""
    assert isinstance(app.PORT, int)


def test_methods_is_list():
    """METHODS must be a list type."""
    assert isinstance(app.METHODS, list)


# ---------------------------------------------------------------------------
# Flask App Identity Tests
# ---------------------------------------------------------------------------


def test_flask_app_instance_type():
    """app.app must be an instance of flask.Flask."""
    assert isinstance(app.app, Flask)


def test_flask_app_name():
    """Flask app name must equal 'app' — the module name via Flask(__name__).

    When ``app.py`` is imported (rather than executed directly),
    ``__name__`` resolves to ``'app'``, so ``Flask(__name__)`` produces
    a Flask instance whose ``.name`` attribute is ``'app'``.
    """
    assert app.app.name == 'app'


# ---------------------------------------------------------------------------
# __main__ Guard / Startup Lifecycle Tests
# ---------------------------------------------------------------------------


def test_main_guard_calls_app_run_with_correct_args():
    """Simulating ``python app.py`` must invoke app.run(host=HOST, port=PORT).

    Uses ``runpy.run_module`` to re-execute the app module with
    ``__name__`` set to ``'__main__'``, and ``unittest.mock.patch`` to
    intercept the ``Flask.run()`` call at the class level so no real TCP
    port is bound.

    The class-level patch is necessary because ``runpy.run_module``
    creates a fresh namespace with a new Flask instance — patching the
    existing ``app.app.run`` would only affect the original instance.
    """
    with patch.object(Flask, 'run') as mock_run:
        runpy.run_module('app', run_name='__main__')
        mock_run.assert_called_once_with(host='127.0.0.1', port=3000)


def test_import_does_not_call_app_run():
    """Normal module import must NOT invoke app.run() — __main__ guard works.

    Reloading the app module re-executes all module-level code with
    ``__name__`` set to ``'app'`` (not ``'__main__'``).  The
    ``if __name__ == '__main__'`` guard must prevent ``Flask.run()`` from
    being called.  Patching at the class level ensures the assertion
    covers the freshly-created Flask instance produced by the reload.
    """
    import importlib

    with patch.object(Flask, 'run') as mock_run:
        importlib.reload(app)
        mock_run.assert_not_called()
