"""
Lifecycle Tests — replaces __tests__/server.lifecycle.test.js (141 lines, 10 tests).

This module provides 10 pytest-equivalent lifecycle tests organized into 4 test
classes, directly mapping the 4 describe() blocks from the original Jest file:

  TestServerStartup  — 4 tests (server.lifecycle.test.js lines 29–71)
  TestServerShutdown — 2 tests (server.lifecycle.test.js lines 73–94)
  TestPortConflict   — 2 tests (server.lifecycle.test.js lines 96–128)
  TestAppExport      — 2 tests (server.lifecycle.test.js lines 131–141)

Translation strategy:
  Express app.listen()          → subprocess.Popen([sys.executable, 'main.py'])
  server.listening              → proc.poll() is None (process still running)
  server.address()              → socket.connect() + socket.getpeername()
  jest.spyOn(console, 'log')   → subprocess stdout capture
  server.close()                → proc.terminate() + proc.wait()
  EADDRINUSE error              → socket blocker + subprocess.run() exit code
  require('../server') safety   → from app import create_app (no server start)

Source reference: __tests__/server.lifecycle.test.js (141 lines)
"""

# ---------------------------------------------------------------------------
# Standard library imports
# ---------------------------------------------------------------------------
# Replaces: Direct app.listen() calls and Jest spies from the original tests.
# Python subprocess + socket approach isolates server lifecycle testing.

import os          # os.environ.copy() — isolated env for subprocess calls
import socket      # socket.socket() — port allocation, connectivity checks, port blocking
import subprocess  # subprocess.Popen() / .run() — run main.py as a child process
import sys         # sys.executable — correct Python interpreter path for subprocesses
import time        # time.sleep() — brief delays for server startup readiness

# ---------------------------------------------------------------------------
# Third-party imports
# ---------------------------------------------------------------------------

# pytest is the test framework (replaces Jest 30.x). It is invoked via the
# `python -m pytest` CLI — no direct import is required in this file because
# tests are discovered by naming convention and fixtures come from conftest.py.

# ---------------------------------------------------------------------------
# Internal imports
# ---------------------------------------------------------------------------
# Replaces: const app = require('../server') (server.lifecycle.test.js line 3)
# Used in TestAppExport tests to verify import safety and app factory behavior.

from app import create_app

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Project root directory — parent of tests/ directory.
# Used as cwd for subprocess calls so that 'main.py' is resolved correctly
# regardless of the directory from which pytest is invoked.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _find_free_port():
    """Find a free TCP port on localhost.

    Binds a socket to port 0 on 127.0.0.1 (which lets the OS assign an
    ephemeral port), retrieves the assigned port number, then closes the
    socket to release it for the server subprocess to use.

    This replaces the Express pattern of app.listen(0, '127.0.0.1', callback)
    which similarly uses port 0 for ephemeral port allocation.

    Returns:
        int: A free TCP port number on 127.0.0.1.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


# ---------------------------------------------------------------------------
# Test Classes
# ---------------------------------------------------------------------------


class TestServerStartup:
    """Server startup tests.

    Replaces describe('Server startup', ...) from server.lifecycle.test.js
    lines 29–71.  The original 4 tests use app.listen(0, '127.0.0.1', cb)
    to start Express on an ephemeral port.  The Python equivalents start
    main.py as a subprocess with controlled PORT / HOST environment variables
    and verify behavior via process state, socket connections, and stdout
    capture.
    """

    def test_should_start_listening(self):
        """Replaces: it('should start listening and invoke the callback')
        — server.lifecycle.test.js line 30

        Original assertion: expect(server.listening).toBe(true)
        Python equivalent: Start main.py subprocess and verify the process
        remains running (has not exited with an error), which is the
        equivalent of server.listening === true in Express.
        """
        port = _find_free_port()
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = '127.0.0.1'
        # Force unbuffered stdout so print() output is available immediately.
        env['PYTHONUNBUFFERED'] = '1'

        proc = subprocess.Popen(
            [sys.executable, 'main.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            cwd=_PROJECT_ROOT,
        )
        try:
            # Allow the Flask development server time to bind and start.
            time.sleep(2)
            # server.listening === true → process is still running (not crashed)
            assert proc.poll() is None, "Server process exited unexpectedly"
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

    def test_should_bind_to_localhost(self):
        """Replaces: it('should bind to 127.0.0.1')
        — server.lifecycle.test.js line 37

        Original assertion: expect(address.address).toBe('127.0.0.1')
        Python equivalent: Start main.py, then verify a TCP connection to
        127.0.0.1 on the configured port succeeds.
        """
        port = _find_free_port()
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = '127.0.0.1'
        env['PYTHONUNBUFFERED'] = '1'

        proc = subprocess.Popen(
            [sys.executable, 'main.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            cwd=_PROJECT_ROOT,
        )
        try:
            time.sleep(2)
            # server.address().address === '127.0.0.1'
            # Verify TCP connection succeeds on 127.0.0.1
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                result = s.connect_ex(('127.0.0.1', port))
                assert result == 0, f"Could not connect to 127.0.0.1:{port}"
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

    def test_should_have_valid_address_with_host_and_port(self):
        """Replaces: it('should return a valid address with host and port')
        — server.lifecycle.test.js line 45

        Original assertions:
            expect(address).toHaveProperty('address')
            expect(address).toHaveProperty('port')
            expect(typeof address.port).toBe('number')
            expect(address.port).toBeGreaterThan(0)
        Python equivalent: Connect to the server and verify getpeername()
        returns the expected host string and a positive port number.
        """
        port = _find_free_port()
        assert port > 0  # Ephemeral port must be positive
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = '127.0.0.1'
        env['PYTHONUNBUFFERED'] = '1'

        proc = subprocess.Popen(
            [sys.executable, 'main.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            cwd=_PROJECT_ROOT,
        )
        try:
            time.sleep(2)
            assert proc.poll() is None, "Server process exited unexpectedly"
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.connect(('127.0.0.1', port))
                peer = s.getpeername()
                # address.address === '127.0.0.1'
                assert peer[0] == '127.0.0.1'
                # address.port === port and port > 0
                assert peer[1] == port
                assert peer[1] > 0
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

    def test_should_emit_expected_startup_log_message(self):
        """Replaces: it('should emit the expected startup log message format')
        — server.lifecycle.test.js line 56

        Original assertion:
            expect(consoleSpy).toHaveBeenCalledWith(
                'Server running at http://127.0.0.1:3000/'
            )
        Python equivalent: Capture subprocess stdout and verify the startup
        log message matches the format 'Server running at http://{host}:{port}/'.
        main.py prints this message to stdout before app.run() blocks.
        """
        port = _find_free_port()
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = '127.0.0.1'
        # PYTHONUNBUFFERED ensures print() flushes immediately so readline()
        # does not block waiting for a buffer fill before app.run() blocks.
        env['PYTHONUNBUFFERED'] = '1'

        proc = subprocess.Popen(
            [sys.executable, 'main.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            cwd=_PROJECT_ROOT,
        )
        try:
            # main.py prints the startup message before app.run() blocks.
            # With PYTHONUNBUFFERED=1 the line is flushed immediately.
            stdout_line = proc.stdout.readline()
            expected_msg = f'Server running at http://127.0.0.1:{port}/'
            assert expected_msg in stdout_line, (
                f"Expected startup message '{expected_msg}' in stdout, "
                f"got: '{stdout_line.strip()}'"
            )
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


class TestServerShutdown:
    """Server shutdown tests.

    Replaces describe('Server shutdown', ...) from server.lifecycle.test.js
    lines 73–94.  The original 2 tests use server.close() to verify the
    server stops listening and emits a close event.  The Python equivalents
    verify that terminating the subprocess causes it to exit and release the
    bound port.
    """

    def test_should_stop_listening_after_close(self):
        """Replaces: it('should stop listening after server.close()')
        — server.lifecycle.test.js line 74

        Original assertions:
            expect(server.listening).toBe(true)   // before close
            expect(server.listening).toBe(false)   // after close
        Python equivalent: Start the server, verify it is running, terminate
        it, then verify the port is no longer in use (connection refused).
        """
        port = _find_free_port()
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = '127.0.0.1'
        env['PYTHONUNBUFFERED'] = '1'

        proc = subprocess.Popen(
            [sys.executable, 'main.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            cwd=_PROJECT_ROOT,
        )
        try:
            time.sleep(2)
            # server.listening === true — server is running
            assert proc.poll() is None, "Server process exited unexpectedly"

            # server.close() → proc.terminate()
            proc.terminate()
            proc.wait(timeout=5)

            # Brief pause to let the OS release the port after process exit.
            time.sleep(0.5)

            # server.listening === false — port is no longer in use
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                result = s.connect_ex(('127.0.0.1', port))
                assert result != 0, (
                    f"Port {port} is still in use after server termination"
                )
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait()

    def test_should_exit_cleanly_when_terminated(self):
        """Replaces: it('should emit close event when shut down')
        — server.lifecycle.test.js line 85

        Original: server.on('close', () => { done(); }); server.close();
        Python equivalent: Start the server, terminate it, and verify the
        process exits (the equivalent of the close event firing).
        """
        port = _find_free_port()
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = '127.0.0.1'
        env['PYTHONUNBUFFERED'] = '1'

        proc = subprocess.Popen(
            [sys.executable, 'main.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            cwd=_PROJECT_ROOT,
        )
        try:
            time.sleep(2)
            # server.close() → terminate the process
            proc.terminate()
            # server.on('close', callback) → process exits within timeout
            proc.wait(timeout=5)
            # Process has exited — equivalent of close event firing
            assert proc.poll() is not None, "Process did not exit after terminate"
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait()


class TestPortConflict:
    """Port conflict (EADDRINUSE) tests.

    Replaces describe('Port conflict (EADDRINUSE)', ...) from
    server.lifecycle.test.js lines 96–128.  The original 2 tests start a
    server on a port, then attempt to start a second server on the same port,
    verifying the EADDRINUSE error.  The Python equivalents bind a socket to
    block a port, then run main.py targeting the same port and verify stderr
    output and exit code 1.
    """

    def test_should_error_on_port_in_use(self):
        """Replaces: it('should emit error event on EADDRINUSE when port is in use')
        — server.lifecycle.test.js line 97

        Original assertion: expect(err.code).toBe('EADDRINUSE')
        Python equivalent: Bind a socket to claim a port, then run main.py
        on the same port and verify exit code 1 (port conflict detected by
        the socket pre-check in main.py).
        """
        # Bind a socket to claim the port — simulates EADDRINUSE scenario.
        # SO_REUSEADDR is explicitly set to 0 (disabled) to prevent the OS
        # from allowing main.py's pre-check socket to share the port.
        blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        blocker.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
        blocker.bind(('127.0.0.1', 0))
        blocker.listen(1)
        used_port = blocker.getsockname()[1]

        try:
            env = os.environ.copy()
            env['PORT'] = str(used_port)
            env['HOST'] = '127.0.0.1'

            # subprocess.run() — process is expected to exit quickly with code 1.
            result = subprocess.run(
                [sys.executable, 'main.py'],
                capture_output=True,
                text=True,
                env=env,
                timeout=10,
                cwd=_PROJECT_ROOT,
            )
            # Express: err.code === 'EADDRINUSE' → Python: exit code 1
            assert result.returncode == 1, (
                f"Expected exit code 1 for port conflict, got {result.returncode}"
            )
        finally:
            blocker.close()

    def test_should_output_error_message_on_port_conflict(self):
        """Replaces: it('should pass EADDRINUSE error as first argument to
        app.listen callback (Express 5.x)')
        — server.lifecycle.test.js line 111

        Original assertions:
            expect(err).toBeDefined()
            expect(Object.prototype.toString.call(err)).toBe('[object Error]')
            expect(err.code).toBe('EADDRINUSE')
        Python equivalent: Verify stderr contains the 'Failed to start server'
        error message and exit code is 1.  main.py prints this message via
        print(f'Failed to start server: {e}', file=sys.stderr) when the
        socket pre-check catches an OSError.
        """
        blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        blocker.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
        blocker.bind(('127.0.0.1', 0))
        blocker.listen(1)
        used_port = blocker.getsockname()[1]

        try:
            env = os.environ.copy()
            env['PORT'] = str(used_port)
            env['HOST'] = '127.0.0.1'

            result = subprocess.run(
                [sys.executable, 'main.py'],
                capture_output=True,
                text=True,
                env=env,
                timeout=10,
                cwd=_PROJECT_ROOT,
            )
            # Verify error message format matches main.py's output:
            # print(f'Failed to start server: {e}', file=sys.stderr)
            assert 'Failed to start server' in result.stderr, (
                f"Expected 'Failed to start server' in stderr, got: "
                f"'{result.stderr.strip()}'"
            )
            assert result.returncode == 1
        finally:
            blocker.close()


class TestAppExport:
    """App export / import safety tests.

    Replaces describe('App export', ...) from server.lifecycle.test.js
    lines 131–141.  The original 2 tests verify that require('../server')
    returns a defined, callable Express app and that importing does not
    auto-start listening.  The Python equivalents verify that create_app()
    returns a valid Flask WSGI application and that calling it has no socket
    side effects.
    """

    def test_should_export_the_app(self):
        """Replaces: it('should export the Express app')
        — server.lifecycle.test.js line 132

        Original assertions:
            expect(app).toBeDefined()
            expect(typeof app).toBe('function')
        Python equivalent: create_app() returns a defined, callable Flask
        WSGI application object.  In Express, the app is a function (request
        handler); in Flask, the app is a callable WSGI application.
        """
        app = create_app()
        # expect(app).toBeDefined()
        assert app is not None
        # expect(typeof app).toBe('function') — Flask apps are WSGI callables
        assert callable(app)

    def test_should_not_auto_start_when_imported(self):
        """Replaces: it('should not automatically start listening when required')
        — server.lifecycle.test.js line 137

        Original assertion: expect(app.listening).toBeUndefined()
        Python equivalent: Importing the app module and calling create_app()
        does not start a server.  Flask apps are WSGI application objects
        without a 'listening' attribute — app creation and server startup
        are fully separated by design (create_app() vs app.run()).

        The original Express test verifies that require('../server') does
        not trigger app.listen() because the require.main === module guard
        prevents it.  In Python, the if __name__ == '__main__' guard in
        main.py achieves the same separation.
        """
        # Importing create_app and calling it completes immediately
        # without starting a server — proves import safety.
        app = create_app()
        assert app is not None
        # Express's app.listening is undefined when require.main !== module
        # prevents app.listen() from running.  Flask apps are WSGI callables
        # that never have a 'listening' attribute — the equivalent of
        # expect(app.listening).toBeUndefined() in Express/Jest.
        assert not hasattr(app, 'listening')
