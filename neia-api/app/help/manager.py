from __future__ import annotations

import json
import math
import os
import re
import threading
import time
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


_TOKEN_RE = re.compile(r"[a-z0-9_]+")
_CHUNK_SIZE = 700
_CHUNK_OVERLAP = 120
_MAX_CONTEXT_CHARS = 5200
_EXTENSIONS = {".md", ".rst", ".txt"}
_SKIP_DIR_NAMES = {"_build", ".git", ".venv", "__pycache__"}


@dataclass
class _Chunk:
    path: str
    heading: str
    text: str
    tokens: Counter[str]


def _as_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall((text or "").lower())


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if not cleaned:
        return []
    if len(cleaned) <= chunk_size:
        return [cleaned]
    chunks: list[str] = []
    step = max(1, chunk_size - overlap)
    for start in range(0, len(cleaned), step):
        piece = cleaned[start : start + chunk_size].strip()
        if piece:
            chunks.append(piece)
        if start + chunk_size >= len(cleaned):
            break
    return chunks


def _split_sections(text: str) -> list[tuple[str, str]]:
    lines = (text or "").splitlines()
    sections: list[tuple[str, list[str]]] = []
    heading = "Document"
    buffer: list[str] = []
    for line in lines:
        stripped = line.strip()
        is_md_heading = stripped.startswith("#")
        is_rst_heading = (
            len(stripped) >= 3
            and len(stripped) == len(line.strip())
            and all(ch in {"=", "-", "~", "^"} for ch in stripped)
            and buffer
        )
        if is_md_heading:
            if buffer:
                sections.append((heading, buffer))
            heading = stripped.lstrip("#").strip() or "Document"
            buffer = []
            continue
        if is_rst_heading:
            maybe_heading = buffer[-1].strip()
            if maybe_heading:
                if len(buffer) > 1:
                    sections.append((heading, buffer[:-1]))
                heading = maybe_heading
                buffer = []
            continue
        buffer.append(line)
    if buffer:
        sections.append((heading, buffer))
    out: list[tuple[str, str]] = []
    for sec_heading, sec_lines in sections:
        sec_text = "\n".join(sec_lines).strip()
        if sec_text:
            out.append((sec_heading, sec_text))
    return out


def _expand_query(query: str) -> str:
    normalized = (query or "").lower()
    expansions: list[str] = []
    if "api" in normalized:
        expansions.extend(["uvicorn", "app.main:app", "port 8050", "neia-api", "dev"])
    if "ui" in normalized:
        expansions.extend(["npm run dev", "vite", "port 3000", "port 3002", "neia-ui"])
    if "sensor plugin" in normalized or "plugin" in normalized:
        expansions.extend(["rs-nexus-sensors-plugins", "pyproject", "README", "sensor"])
    if "algorithm plugin" in normalized:
        expansions.extend(["rs-nexus-algorithm-plugins", "processing.py", "core.py"])
    if "edge" in normalized:
        expansions.extend(["rs-nexus-os", "deployment", "ansible", "gateway"])
    if not expansions:
        return query
    return f"{query} {' '.join(expansions)}"


class HelpManager:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.enabled = _as_bool(os.getenv("NEIA_HELP_ENABLED", "1"), default=True)
        self.model = os.getenv("NEIA_HELP_MODEL", "llama3.2:3b").strip() or "llama3.2:3b"
        self.ollama_url = os.getenv("NEIA_HELP_OLLAMA_URL", "http://localhost:11434").rstrip("/")
        self.timeout_seconds = float(os.getenv("NEIA_HELP_TIMEOUT_SECONDS", "12"))
        self.default_top_k = int(os.getenv("NEIA_HELP_TOP_K", "6"))
        self.ollama_retries = max(0, int(os.getenv("NEIA_HELP_OLLAMA_RETRIES", "2")))
        self.ollama_retry_backoff_seconds = max(
            0.0, float(os.getenv("NEIA_HELP_OLLAMA_RETRY_BACKOFF_SECONDS", "1.0"))
        )
        self.ollama_keep_alive = os.getenv("NEIA_HELP_OLLAMA_KEEP_ALIVE", "30m").strip()
        self._lock = threading.Lock()
        self._chunks: list[_Chunk] = []
        self._idf: dict[str, float] = {}
        self._indexed_at: float | None = None
        self._files_indexed = 0

        roots_env = os.getenv("NEIA_HELP_DOCS_ROOTS", "").strip()
        roots: list[Path] = []
        if roots_env:
            for raw in roots_env.split(":"):
                candidate = Path(raw).expanduser().resolve()
                roots.append(candidate)
        else:
            roots = [
                (self.base_dir / "docs").resolve(),
                (self.base_dir.parent / "rs-nexus-os" / "docs").resolve(),
            ]
        self.docs_roots = roots

    def status(self) -> dict[str, Any]:
        indexed = self._indexed_at is not None
        return {
            "enabled": self.enabled,
            "docs_roots": [str(p) for p in self.docs_roots],
            "model": self.model,
            "ollama_url": self.ollama_url,
            "indexed": indexed,
            "files_indexed": self._files_indexed,
            "chunks_indexed": len(self._chunks),
            "indexed_at": self._indexed_at,
            "ollama_reachable": self._ollama_reachable(),
        }

    def reindex(self) -> dict[str, Any]:
        with self._lock:
            self._build_index()
        return self.status()

    def ask(self, question: str, top_k: int | None = None) -> dict[str, Any]:
        question = (question or "").strip()
        if not question:
            return {"error": "Missing question"}
        if not self.enabled:
            return {"error": "Help is disabled", "enabled": False}
        with self._lock:
            if not self._chunks:
                self._build_index()
        limit = max(1, min(12, int(top_k or self.default_top_k)))
        ranked = self._retrieve(question, limit)
        if not ranked:
            return {
                "answer": "I could not find relevant local docs for that question.",
                "sources": [],
                "confidence": 0.0,
                "used_ollama": False,
            }
        context_parts: list[str] = []
        used_chars = 0
        for idx, item in enumerate(ranked, start=1):
            chunk = item["chunk"]
            section = f"[{idx}] {chunk.path} :: {chunk.heading}\n{chunk.text}"
            next_chars = len(section) + 2
            if used_chars + next_chars > _MAX_CONTEXT_CHARS:
                break
            context_parts.append(section)
            used_chars += next_chars
        prompt = self._build_prompt(question, context_parts)
        llm_answer, llm_error = self._ask_ollama(prompt)
        sources = []
        seen: set[str] = set()
        for item in ranked:
            chunk = item["chunk"]
            key = f"{chunk.path}|{chunk.heading}"
            if key in seen:
                continue
            seen.add(key)
            sources.append(
                {
                    "path": chunk.path,
                    "heading": chunk.heading,
                    "score": round(float(item["score"]), 4),
                }
            )
        if llm_answer:
            answer = llm_answer.strip()
        else:
            top = ranked[0]["chunk"]
            answer = (
                "I could not reach Ollama, but the most relevant local section is "
                f"{top.path} ({top.heading}). Start there."
            )
        confidence = min(1.0, max(0.0, float(ranked[0]["score"]) / 8.0))
        out: dict[str, Any] = {
            "answer": answer,
            "sources": sources,
            "confidence": round(confidence, 3),
            "used_ollama": bool(llm_answer),
            "model": self.model,
        }
        if llm_error:
            out["llm_error"] = llm_error
        return out

    def _build_index(self) -> None:
        chunks: list[_Chunk] = []
        files_indexed = 0
        for root in self.docs_roots:
            if not root.exists() or not root.is_dir():
                continue
            for path in root.rglob("*"):
                if not path.is_file():
                    continue
                if any(part in _SKIP_DIR_NAMES for part in path.parts):
                    continue
                if path.suffix.lower() not in _EXTENSIONS:
                    continue
                try:
                    content = path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                files_indexed += 1
                try:
                    rel = str(path.relative_to(self.base_dir.parent))
                except Exception:
                    rel = str(path)
                for heading, section_text in _split_sections(content):
                    for piece in _chunk_text(section_text, _CHUNK_SIZE, _CHUNK_OVERLAP):
                        tokens = Counter(_tokenize(piece))
                        if not tokens:
                            continue
                        chunks.append(
                            _Chunk(
                                path=rel,
                                heading=heading,
                                text=piece,
                                tokens=tokens,
                            )
                        )
        df: Counter[str] = Counter()
        for chunk in chunks:
            for token in chunk.tokens:
                df[token] += 1
        total_docs = max(1, len(chunks))
        idf: dict[str, float] = {}
        for token, freq in df.items():
            idf[token] = math.log((1 + total_docs) / (1 + freq)) + 1.0
        self._chunks = chunks
        self._idf = idf
        self._files_indexed = files_indexed
        self._indexed_at = time.time()

    def _retrieve(self, question: str, top_k: int) -> list[dict[str, Any]]:
        query = _expand_query(question)
        q_tokens = Counter(_tokenize(query))
        if not q_tokens:
            return []
        ranked: list[dict[str, Any]] = []
        for chunk in self._chunks:
            score = 0.0
            for token, qtf in q_tokens.items():
                tf = chunk.tokens.get(token, 0)
                if tf <= 0:
                    continue
                idf = self._idf.get(token, 1.0)
                score += float(qtf) * (1.0 + math.log(1.0 + tf)) * idf
            if score > 0:
                ranked.append({"chunk": chunk, "score": score})
        ranked.sort(key=lambda item: item["score"], reverse=True)
        return ranked[:top_k]

    def _build_prompt(self, question: str, context_parts: list[str]) -> str:
        context = "\n\n".join(context_parts) if context_parts else "No context provided."
        return (
            "You are an offline docs assistant for RS Nexus.\n"
            "Answer only using the provided CONTEXT.\n"
            "If the answer is missing from context, say that clearly.\n"
            "Keep answers concise and practical.\n"
            "Include citations in the form [n] that map to CONTEXT blocks.\n\n"
            f"QUESTION:\n{question}\n\n"
            f"CONTEXT:\n{context}\n\n"
            "ANSWER:"
        )

    def _ask_ollama(self, prompt: str) -> tuple[str | None, str | None]:
        url = f"{self.ollama_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
            },
        }
        if self.ollama_keep_alive:
            payload["keep_alive"] = self.ollama_keep_alive

        last_error: str | None = None
        attempts = self.ollama_retries + 1
        for attempt in range(attempts):
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
                    body = resp.read().decode("utf-8", errors="ignore")
                parsed = json.loads(body)
                answer = parsed.get("response")
                if isinstance(answer, str) and answer.strip():
                    return answer, None
                last_error = "Empty response from Ollama"
            except urllib.error.URLError as exc:
                last_error = str(exc)
            except Exception as exc:
                last_error = str(exc)

            if attempt < attempts - 1 and self.ollama_retry_backoff_seconds > 0:
                time.sleep(self.ollama_retry_backoff_seconds * (attempt + 1))

        return None, last_error or "Unknown Ollama error"

    def _ollama_reachable(self) -> bool:
        url = f"{self.ollama_url}/api/tags"
        req = urllib.request.Request(url, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=2.0):
                return True
        except Exception:
            return False
