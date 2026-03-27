"""Tests verifying module import safety and __main__ startup behavior.

This module tests ``app.py`` lines 59-64 — the ``if __name__ == '__main__':``
guard block — plus verifying that module import does not trigger server
startup.  All server-starting side effects (``print()`` and ``app.run()``)
are mocked to prevent actual TCP socket binding during tests.

Test inventory:
    test_import_does_not_start_server   — import safety (no auto-start)
    test_app_is_flask_instance          — Flask type verification
    test_main_prints_startup_message    — exact startup message check
    test_main_calls_run_with_correct_host_and_port — binding parameters
    test_main_calls_print_before_run    — call ordering guarantee
"""

from unittest.mock import patch, MagicMock
import importlib
import runpy

from flask import Flask


# ---------------------------------------------------------------------------
# Import safety tests
# ---------------------------------------------------------------------------

def test_import_does_not_start_server(app_instance):
    """Importing app.py must create a Flask app without starting the server.

    The ``app_instance`` fixture (from conftest.py) imports the ``app``
    module at session scope.  If the ``__main__`` guard were missing or
    broken, ``app.run()`` would execute during import and block
    indefinitely on a listening socket — causing this test to hang
    rather than complete.

    Successful completion of this test is itself proof of import safety.
    The explicit assertions below further verify the app object is valid.
    """
    assert app_instance is not None, (
        "Flask app object should not be None after module import"
    )
    # Flask sets .name from the first positional arg (__name__), which is
    # the module name 'app' when imported (not '__main__').
    assert app_instance.name == "app", (
        f"Expected app.name == 'app', got '{app_instance.name}'"
    )


def test_app_is_flask_instance(app_instance):
    """The app object created at module level must be a genuine Flask instance.

    Verifies that ``app.py`` line 18 (``app = Flask(__name__)``) produces
    an actual ``flask.Flask`` application object, not a proxy or mock.
    """
    assert isinstance(app_instance, Flask), (
        f"Expected Flask instance, got {type(app_instance).__name__}"
    )


# ---------------------------------------------------------------------------
# __main__ startup behavior tests
# ---------------------------------------------------------------------------

def test_main_prints_startup_message():
    """Executing app.py as __main__ must print the exact startup message.

    The expected message is defined at ``app.py`` line 62::

        print('Server running at http://127.0.0.1:3000/')

    ``builtins.print`` is mocked to capture the output, and
    ``flask.Flask.run`` is mocked to prevent actual server startup.
    ``runpy.run_module`` re-executes ``app.py`` with ``__name__`` set to
    ``'__main__'``, triggering the guarded code path.

    Note: The mock target is ``flask.Flask.run`` (class-level) rather than
    ``app.app.run`` because ``runpy.run_module`` creates a fresh execution
    context with a new Flask instance that is not the same object as the
    one cached in ``sys.modules['app']``.
    """
    with patch("builtins.print") as mock_print, \
         patch("flask.Flask.run"):
        runpy.run_module("app", run_name="__main__")
        mock_print.assert_called_once_with(
            "Server running at http://127.0.0.1:3000/"
        )


def test_main_calls_run_with_correct_host_and_port():
    """The __main__ block must call app.run() with the correct binding config.

    Verifies ``app.py`` line 64::

        app.run(host='127.0.0.1', port=3000)

    The host and port must match the original Node.js server's binding
    configuration exactly: ``host='127.0.0.1'`` (string) and
    ``port=3000`` (integer).

    The assertion inspects keyword arguments via ``call_args.kwargs`` to
    remain robust regardless of whether the patched class method receives
    ``self`` as a positional argument.
    """
    with patch("builtins.print"), \
         patch("flask.Flask.run") as mock_run:
        runpy.run_module("app", run_name="__main__")
        mock_run.assert_called_once()
        kwargs = mock_run.call_args.kwargs
        assert kwargs.get("host") == "127.0.0.1", (
            f"Expected host='127.0.0.1', got host='{kwargs.get('host')}'"
        )
        assert kwargs.get("port") == 3000, (
            f"Expected port=3000, got port={kwargs.get('port')}"
        )


def test_main_calls_print_before_run():
    """The startup message must be printed before the server starts listening.

    This validates the ordering of ``app.py`` lines 62-64: ``print()`` is
    called first, then ``app.run()``.  Reversing this order would mean the
    startup message is never printed (since ``app.run()`` blocks the
    process on a listening socket).

    Each mock's ``side_effect`` appends to a shared list to record the
    invocation sequence.  The ``*args, **kwargs`` signature accommodates
    any positional or keyword arguments passed to either function.
    """
    call_order = []
    with patch("builtins.print",
               side_effect=lambda *args, **kwargs: call_order.append("print")), \
         patch("flask.Flask.run",
               side_effect=lambda *args, **kwargs: call_order.append("run")):
        runpy.run_module("app", run_name="__main__")
        assert call_order == ["print", "run"], (
            f"Expected ['print', 'run'], got {call_order}"
        )
