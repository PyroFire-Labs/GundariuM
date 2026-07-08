# Whitepaper PDF Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress `public/GundariuMwhitepaper.pdf` from 22.1MB down to a few MB so it loads reasonably on mobile data, without losing pages or making it unreadable.

**Architecture:** The file's size is almost entirely two oversized embedded raster images (diagnosed below), not text/vector content. Ghostscript's `pdfwrite` device can recompress/downsample embedded images in place while leaving page count and text untouched. Verification is file-size + page-count checks via `pdfinfo`, plus a visual side-by-side render of the worst offending page (before vs. after) inspected directly.

**Tech Stack:** Ghostscript (`gs`, installed via Homebrew), poppler-utils (`pdfinfo`, `pdfimages`, `pdftoppm` — already installed at `/opt/homebrew/bin/`).

## Global Constraints

- Output PDF must still be exactly **13 pages** (no content loss).
- Target size: **under 5MB** (spec says "a few MB"; diagnostics below suggest it will land far lower).
- Do **not** deploy to production (`vercel --prod`) as part of this plan — stop after local verification and flag for Joshua's review/deploy decision, matching how prior production deploys in this repo have been confirmed before running.
- `public/` is served statically by Next.js — never leave scratch/backup files inside `public/`, since anything there gets a live URL. Use `/tmp` for intermediates; rely on git history (the current 22.1MB version is already committed) as the rollback path, not a local `.orig` copy.

## Diagnosis (already run, informs the plan)

```
$ pdfinfo public/GundariuMwhitepaper.pdf
Pages:           13
File size:       22137237 bytes
PDF version:     1.4

$ pdfimages -list public/GundariuMwhitepaper.pdf
page   num  type   width height color comp bpc  size ratio
   1     0 image    1920  1080  rgb     3   8   4509K  74%
   2     1 image    4032  3024  rgb     3   8   16.7M  48%
```

Page 2's single image (4032×3024, a full 12MP photo resolution embedded at ~900 ppi into a letter-size page) accounts for ~75% of the total file size on its own. Neither image needs anywhere near this pixel density for on-screen/mobile reading.

---

### Task 1: Compress and replace the whitepaper PDF

**Files:**
- Modify: `public/GundariuMwhitepaper.pdf` (binary asset, replaced in place at the end)

**Interfaces:**
- Consumes: nothing (standalone asset task)
- Produces: a smaller `public/GundariuMwhitepaper.pdf`, same URL path (`/GundariuMwhitepaper.pdf`), same 13 pages, referenced unchanged from `src/app/page.tsx:313` and `docs/brand-guidelines.md`

- [ ] **Step 1: Install Ghostscript**

Run: `brew install ghostscript`
Expected: installs successfully; `which gs` then prints a path under `/opt/homebrew/bin/` or `/usr/local/bin/`.

- [ ] **Step 2: Verify Ghostscript is on PATH**

Run: `gs --version`
Expected: prints a version number (e.g. `10.x.x`) with no error.

- [ ] **Step 3: Run the compression pass (ebook preset, 150 DPI)**

```bash
gs -sDEVICE=pdfwrite \
   -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/ebook \
   -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=/tmp/gundarium-whitepaper-compressed.pdf \
   public/GundariuMwhitepaper.pdf
```

Expected: exits with no error output; `/tmp/gundarium-whitepaper-compressed.pdf` exists.

- [ ] **Step 4: Check the compressed size**

Run: `stat -f%z /tmp/gundarium-whitepaper-compressed.pdf`

Expected: a number well under `5000000` (5MB). **If the number is still above `5000000`**, re-run Step 3 with the more aggressive screen preset instead, writing to the same path:

```bash
gs -sDEVICE=pdfwrite \
   -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/screen \
   -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=/tmp/gundarium-whitepaper-compressed.pdf \
   public/GundariuMwhitepaper.pdf
```

Then re-check the size the same way before continuing.

- [ ] **Step 5: Verify page count didn't change**

Run: `pdfinfo /tmp/gundarium-whitepaper-compressed.pdf | grep Pages`
Expected: `Pages:           13`

- [ ] **Step 6: Render page 2 (the worst offender) from both versions for a visual check**

```bash
mkdir -p /tmp/wp_compare
pdftoppm -f 2 -l 2 -png -r 100 public/GundariuMwhitepaper.pdf /tmp/wp_compare/before
pdftoppm -f 2 -l 2 -png -r 100 /tmp/gundarium-whitepaper-compressed.pdf /tmp/wp_compare/after
```

Expected: produces `/tmp/wp_compare/before-02.png` and `/tmp/wp_compare/after-02.png`.

- [ ] **Step 7: Visually inspect both renders**

Read both `/tmp/wp_compare/before-02.png` and `/tmp/wp_compare/after-02.png` (e.g. via the Read tool, or open them) and confirm the compressed version is still legible — no visible artifacting, text/diagrams still clear at normal reading size. If quality is unacceptably degraded, redo Step 3 with `-dPDFSETTINGS=/printer` instead (300 DPI, larger but higher quality) and repeat Steps 4–7.

- [ ] **Step 8: Replace the tracked file**

```bash
cp /tmp/gundarium-whitepaper-compressed.pdf public/GundariuMwhitepaper.pdf
```

- [ ] **Step 9: Final verification on the in-place file**

```bash
pdfinfo public/GundariuMwhitepaper.pdf | grep -E "Pages|File size"
```

Expected: `Pages:           13` and a `File size` value under 5,000,000 bytes.

- [ ] **Step 10: Commit**

```bash
git add public/GundariuMwhitepaper.pdf
git commit -m "$(cat <<'EOF'
perf(whitepaper): compress PDF from 22MB to reduce mobile load time

Page 2's embedded image was a full 12MP photo (16.7MB alone) at far
higher pixel density than needed for on-screen reading. Recompressed
via Ghostscript; page count and text content unchanged.
EOF
)"
```

Expected: commit succeeds, `git log -1 --stat` shows `public/GundariuMwhitepaper.pdf` as modified with a large negative byte delta.

---

## Self-Review

- **Spec coverage:** Spec section 6 says "Should be compressed to a few MB." Task 1 covers this end-to-end (diagnose → compress → verify size/pages/visual quality → replace → commit). The spec's only other follow-on items (site GUNR→GNRM swap, remaining GUNR repricing) are explicitly out of scope per the brainstorm and not included here.
- **Placeholder scan:** No TBD/TODO; every step has an exact command and exact expected output, including both compression-quality fallback branches.
- **Type consistency:** N/A — no code interfaces involved, single binary-asset task.
