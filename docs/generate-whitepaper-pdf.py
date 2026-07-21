#!/usr/bin/env python3
"""
Generate the GundariuM Whitepaper PDF from docs/whitepaper.md.

Unlike the previous version of this script, this one actually reads the
markdown source instead of hardcoding the whitepaper's content directly in
Python -- the old version fell out of sync with docs/whitepaper.md because
editing the markdown never touched the PDF at all.

Pipeline: pandoc (markdown -> styled HTML, docs/whitepaper-style.css) ->
headless Chrome (HTML -> PDF). Requires `pandoc` and Google Chrome installed
locally; no LaTeX engine needed.

Usage: python3 docs/generate-whitepaper-pdf.py
Outputs to both docs/GundariuMwhitepaper.pdf and public/GundariuMwhitepaper.pdf.
"""

import subprocess
import tempfile
import shutil
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
MARKDOWN_SRC = os.path.join(SCRIPT_DIR, "whitepaper.md")
CSS_SRC = os.path.join(SCRIPT_DIR, "whitepaper-style.css")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUTPUTS = [
    os.path.join(SCRIPT_DIR, "GundariuMwhitepaper.pdf"),
    os.path.join(REPO_ROOT, "public", "GundariuMwhitepaper.pdf"),
]


def main():
    with tempfile.TemporaryDirectory() as tmp:
        html_path = os.path.join(tmp, "whitepaper.html")
        pdf_path = os.path.join(tmp, "GundariuMwhitepaper.pdf")

        subprocess.run(
            [
                "pandoc", MARKDOWN_SRC,
                "-o", html_path,
                "--standalone",
                f"--css={CSS_SRC}",
                "-M", "pagetitle=GundariuM Whitepaper",
            ],
            check=True,
        )

        subprocess.run(
            [
                CHROME,
                "--headless", "--disable-gpu", "--no-pdf-header-footer",
                f"--print-to-pdf={pdf_path}",
                f"file://{html_path}",
            ],
            check=True,
        )

        for out in OUTPUTS:
            shutil.copy(pdf_path, out)
            print(f"wrote {out}")


if __name__ == "__main__":
    main()
