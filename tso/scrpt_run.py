from __future__ import annotations

import socket
import subprocess
import sys
from pathlib import Path


def is_port_free(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


def pick_port(preferred_ports: list[int], label: str) -> int:
    for port in preferred_ports:
        if is_port_free(port):
            return port
    raise RuntimeError(f"No free {label} port found in: {preferred_ports}")


def ps_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def resolve_backend_python(backend_dir: Path) -> str:
    candidates = [
        backend_dir / "venv" / "Scripts" / "python.exe",
        Path(sys.executable),
    ]
    for candidate in candidates:
        if not candidate.exists():
            continue
        try:
            subprocess.run(
                [str(candidate), "-c", "import sys; print(sys.version)"],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return str(candidate)
        except Exception:
            continue
    raise RuntimeError("Could not find a working Python executable for backend.")


def open_powershell(command: str, title: str) -> subprocess.Popen:
    full_command = f"$Host.UI.RawUI.WindowTitle = {ps_quote(title)}; {command}"
    return subprocess.Popen(
        ["powershell", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", full_command],
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )


def main() -> None:
    root = Path(__file__).resolve().parent
    backend_dir = root / "backend"
    frontend_dir = root / "frontend"

    if not backend_dir.exists() or not frontend_dir.exists():
        raise RuntimeError("Run this file from the project root where /backend and /frontend exist.")

    backend_port = pick_port([5000, 5001], "backend")
    frontend_port = pick_port([5173, 5174], "frontend")

    backend_python = resolve_backend_python(backend_dir)
    proxy_target = f"http://127.0.0.1:{backend_port}"

    backend_command = (
        f"$ErrorActionPreference='Stop'; "
        f"Set-Location {ps_quote(str(backend_dir))}; "
        f"$env:PORT={ps_quote(str(backend_port))}; "
        f"& {ps_quote(backend_python)} 'run.py'"
    )

    frontend_command = (
        f"$ErrorActionPreference='Stop'; "
        f"Set-Location {ps_quote(str(frontend_dir))}; "
        f"if (-not (Test-Path 'node_modules')) {{ npm.cmd install }}; "
        f"$env:VITE_PROXY_TARGET={ps_quote(proxy_target)}; "
        f"npm.cmd run dev -- --host 127.0.0.1 --port {frontend_port}"
    )

    backend_proc = open_powershell(backend_command, f"TSO Backend :{backend_port}")
    frontend_proc = open_powershell(frontend_command, f"TSO Frontend :{frontend_port}")

    print("Started both services in separate terminals.")
    print(f"Backend  : http://127.0.0.1:{backend_port} (PID {backend_proc.pid})")
    print(f"Frontend : http://127.0.0.1:{frontend_port} (PID {frontend_proc.pid})")
    print("Frontend uses Vite proxy for /api and /auth to backend target:", proxy_target)


if __name__ == "__main__":
    main()
