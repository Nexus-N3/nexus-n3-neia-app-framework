from __future__ import annotations

import os
import subprocess
import tempfile
import threading
from typing import Optional


def _run_piper(
    text: str,
    piper_bin: str,
    model: str,
    player: str,
    output_path: str,
) -> tuple[bool, str | None]:
    try:
        proc = subprocess.run(
            [piper_bin, "--model", model, "--output_file", output_path],
            input=text,
            text=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if proc.returncode != 0:
            return False, "Piper failed"
        subprocess.run([player, output_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return True, None
    except FileNotFoundError:
        return False, f"TTS binary not found: {piper_bin}"
    except Exception:
        return False, "TTS failed"
    finally:
        try:
            os.unlink(output_path)
        except OSError:
            pass


def speak(
    text: str,
    *,
    engine: str,
    tts_bin: str,
    voice: Optional[str] = None,
    piper_bin: str,
    piper_model: str,
    piper_player: str,
) -> tuple[bool, str | None]:
    if not text:
        return False, "No text provided"
    if engine == "piper":
        if not piper_model:
            return False, "Piper model not set"
        fd, output_path = tempfile.mkstemp(prefix="neia_tts_", suffix=".wav")
        os.close(fd)
        thread = threading.Thread(
            target=_run_piper,
            args=(text, piper_bin, piper_model, piper_player, output_path),
            daemon=True,
        )
        thread.start()
        return True, None
    cmd = [tts_bin]
    if voice:
        cmd.extend(["-v", voice])
    cmd.append(text)
    try:
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True, None
    except FileNotFoundError:
        return False, f"TTS binary not found: {tts_bin}"
    except Exception:
        return False, "TTS failed"
