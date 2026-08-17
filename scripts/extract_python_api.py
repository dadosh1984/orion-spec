#!/usr/bin/env python3
# ponytail: rung-2 — zero-dep, stdlib only
# ponytail: rung-3 — needed for Python drift check
"""Extract public API symbols from Python source files.

Usage: python3 scripts/extract_python_api.py <file1.py> [file2.py ...]
Output: one symbol per line to stdout.

Public = top-level classes and functions that do NOT start with `_`.
"""

import ast
import sys
import pathlib


def extract_api(file_path: str) -> list[str]:
    """Extract public function and class names from a Python file."""
    try:
        tree = ast.parse(pathlib.Path(file_path).read_text(encoding="utf-8"))
    except (SyntaxError, FileNotFoundError, UnicodeDecodeError):
        return []

    symbols: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if not node.name.startswith("_"):
                symbols.append(node.name)
    return symbols


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: extract_python_api.py <file1.py> [file2.py ...]", file=sys.stderr)
        sys.exit(1)

    all_symbols: list[str] = []
    for f in sys.argv[1:]:
        all_symbols.extend(extract_api(f))

    for s in all_symbols:
        print(s)


if __name__ == "__main__":
    main()
