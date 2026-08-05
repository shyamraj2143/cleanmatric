"""Production server launcher for Railway.

Railway injects ``PORT`` for the container, while an existing public domain may
still be configured to forward to an older target port. Uvicorn supports a
single server accepting multiple pre-bound sockets, so we listen on the
Railway port and a temporary compatibility port without running duplicate app
processes against the SQLite database.
"""

from __future__ import annotations

import os
import socket
from contextlib import closing

import uvicorn


def _read_port(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()
    try:
        port = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a valid integer port, received {raw_value!r}.") from error
    if not 1 <= port <= 65535:
        raise RuntimeError(f"{name} must be between 1 and 65535, received {port}.")
    return port


def _bind_tcp_socket(host: str, port: int) -> socket.socket:
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.set_inheritable(True)
    listener.bind((host, port))
    listener.listen(socket.SOMAXCONN)
    listener.setblocking(False)
    return listener


def main() -> None:
    host = "0.0.0.0"
    railway_port = _read_port("PORT", 8080)
    compatibility_port = _read_port("COMPAT_PORT", 5000)
    requested_ports = list(dict.fromkeys([railway_port, compatibility_port]))
    listeners: list[socket.socket] = []

    try:
        for port in requested_ports:
            try:
                listener = _bind_tcp_socket(host, port)
            except OSError:
                if port == railway_port:
                    raise
                print(
                    f"CleanMetric compatibility port {port} is unavailable; "
                    f"continuing on Railway PORT {railway_port}.",
                    flush=True,
                )
                continue
            listeners.append(listener)

        if not listeners:
            raise RuntimeError("CleanMetric could not bind any HTTP listener.")

        active_ports = ", ".join(str(listener.getsockname()[1]) for listener in listeners)
        print(f"CleanMetric API listening on ports: {active_ports}", flush=True)

        config = uvicorn.Config(
            "app.main:app",
            host=host,
            port=railway_port,
            workers=1,
            proxy_headers=True,
            forwarded_allow_ips="*",
            timeout_keep_alive=75,
            server_header=False,
            access_log=True,
        )
        uvicorn.Server(config).run(sockets=listeners)
    finally:
        for listener in listeners:
            with closing(listener):
                pass


if __name__ == "__main__":
    main()
