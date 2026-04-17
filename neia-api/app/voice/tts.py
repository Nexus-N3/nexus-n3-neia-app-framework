from __future__ import annotations

import os
import shlex
import subprocess
import tempfile
import threading
import time
import wave
from typing import Callable, Optional
from pathlib import Path


def _pad_wav_edges(path: str, lead_ms: int = 520, tail_ms: int = 320) -> None:
    # Some edge audio outputs clip the first/last phonemes. Add short silence padding.
    if lead_ms <= 0 and tail_ms <= 0:
        return
    src = Path(path)
    tmp = src.with_suffix(src.suffix + ".pad")
    with wave.open(str(src), "rb") as rf:
        channels = rf.getnchannels()
        sample_width = rf.getsampwidth()
        sample_rate = rf.getframerate()
        frames = rf.readframes(rf.getnframes())
    bytes_per_frame = channels * sample_width
    lead_frames = max(0, int(sample_rate * (lead_ms / 1000.0)))
    tail_frames = max(0, int(sample_rate * (tail_ms / 1000.0)))
    lead = b"\x00" * (lead_frames * bytes_per_frame)
    tail = b"\x00" * (tail_frames * bytes_per_frame)
    with wave.open(str(tmp), "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(lead + frames + tail)
    tmp.replace(src)


def _run_piper(
    text: str,
    piper_bin: str,
    model: str,
    player: str,
    output_path: str,
    player_device: str = "",
    player_args: str = "",
    pad_lead_ms: int = 220,
    pad_tail_ms: int = 320,
    on_playback_start: Optional[Callable[[], None]] = None,
    on_playback_end: Optional[Callable[[], None]] = None,
) -> tuple[bool, str | None]:
    playback_started = False
    piper_proc: subprocess.Popen | None = None
    generated_output_path = output_path
    try:
        play_cmd = [player]
        player_name = Path(player).name.lower()
        player_args_list = shlex.split(player_args) if player_args else []
        if player_device:
            play_cmd.extend(["-D", player_device])
        if player_args_list:
            play_cmd.extend(player_args_list)
        # Stream Piper output directly to player when no edge padding is requested.
        # This avoids temp-file I/O latency and improves speech start alignment.
        can_stream = (pad_lead_ms <= 0 and pad_tail_ms <= 0 and player_name == "aplay")
        if can_stream:
            if "-t" not in player_args_list and "--file-type" not in player_args_list:
                play_cmd.extend(["-t", "wav"])
            piper_proc = subprocess.Popen(
                [piper_bin, "--model", model],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            if not piper_proc.stdin or not piper_proc.stdout:
                return False, "Piper failed"
            player_proc = subprocess.Popen(
                play_cmd,
                stdin=piper_proc.stdout,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            piper_proc.stdout.close()
            piper_proc.stdin.write(text.encode("utf-8"))
            piper_proc.stdin.close()
            if on_playback_start:
                on_playback_start()
                playback_started = True
            player_rc = player_proc.wait()
            piper_rc = piper_proc.wait()
            if piper_rc != 0:
                return False, "Piper failed"
            if player_rc != 0:
                return False, "Audio playback failed"
            return True, None

        if not generated_output_path:
            fd, generated_output_path = tempfile.mkstemp(prefix="neia_tts_", suffix=".wav")
            os.close(fd)
        proc = subprocess.run(
            [piper_bin, "--model", model, "--output_file", generated_output_path],
            input=text,
            text=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if proc.returncode != 0:
            return False, "Piper failed"
        _pad_wav_edges(generated_output_path, lead_ms=pad_lead_ms, tail_ms=pad_tail_ms)
        play_cmd.append(generated_output_path)
        play_proc = subprocess.Popen(
            play_cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if on_playback_start:
            if pad_lead_ms > 0:
                time.sleep(max(0.0, float(pad_lead_ms) / 1000.0))
            on_playback_start()
            playback_started = True
        play_rc = play_proc.wait()
        if play_rc != 0:
            return False, "Audio playback failed"
        return True, None
    except FileNotFoundError:
        return False, f"TTS binary not found: {piper_bin}"
    except Exception:
        return False, "TTS failed"
    finally:
        if piper_proc and piper_proc.poll() is None:
            piper_proc.kill()
        if playback_started and on_playback_end:
            on_playback_end()
        try:
            if generated_output_path:
                os.unlink(generated_output_path)
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
    piper_player_device: str = "",
    piper_player_args: str = "",
    pad_lead_ms: int = 220,
    pad_tail_ms: int = 320,
    on_playback_start: Optional[Callable[[], None]] = None,
    on_playback_end: Optional[Callable[[], None]] = None,
    blocking: bool = False,
) -> tuple[bool, str | None]:
    if not text:
        return False, "No text provided"
    if engine == "piper":
        if not piper_model:
            return False, "Piper model not set"
        output_path = ""
        if pad_lead_ms > 0 or pad_tail_ms > 0:
            fd, output_path = tempfile.mkstemp(prefix="neia_tts_", suffix=".wav")
            os.close(fd)
        if blocking:
            return _run_piper(
                text,
                piper_bin,
                piper_model,
                piper_player,
                output_path,
                player_device=piper_player_device,
                player_args=piper_player_args,
                pad_lead_ms=pad_lead_ms,
                pad_tail_ms=pad_tail_ms,
                on_playback_start=on_playback_start,
                on_playback_end=on_playback_end,
            )
        thread = threading.Thread(
            target=_run_piper,
            args=(
                text,
                piper_bin,
                piper_model,
                piper_player,
                output_path,
                piper_player_device,
                piper_player_args,
                pad_lead_ms,
                pad_tail_ms,
                on_playback_start,
                on_playback_end,
            ),
            daemon=True,
        )
        thread.start()
        return True, None
    cmd = [tts_bin]
    if voice:
        cmd.extend(["-v", voice])
    cmd.append(text)
    playback_started = False
    try:
        if on_playback_start:
            on_playback_start()
            playback_started = True
        if blocking:
            proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            if proc.returncode != 0:
                return False, "TTS failed"
        else:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True, None
    except FileNotFoundError:
        return False, f"TTS binary not found: {tts_bin}"
    except Exception:
        return False, "TTS failed"
    finally:
        if playback_started and on_playback_end and blocking:
            on_playback_end()
