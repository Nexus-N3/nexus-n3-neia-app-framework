from __future__ import annotations

import argparse

import uvicorn

from .config import NEIA_HOST, NEIA_PORT


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the Nexus N3 NEIA API as a local daemon-style web service."
    )
    parser.add_argument("--host", default=NEIA_HOST, help="Host interface to bind. Defaults to NEIA_HOST or 127.0.0.1.")
    parser.add_argument("--port", type=int, default=NEIA_PORT, help="Port to bind. Defaults to NEIA_PORT or 8080.")
    parser.add_argument("--reload", action="store_true", help="Enable uvicorn autoreload for local development.")
    parser.add_argument(
        "--log-level",
        default="info",
        choices=["critical", "error", "warning", "info", "debug", "trace"],
        help="Uvicorn log level.",
    )
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level,
    )


if __name__ == "__main__":
    main()
