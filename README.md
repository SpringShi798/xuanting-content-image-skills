# xuanting-content-image-skills

A focused fork of **[JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills)** — picks the 9 most useful skills for content production, drops the rest, renames them to bare names (no `baoyu-` prefix), and adds a **grsai provider** so all image generation works through grsai's `nano-banana` series (Gemini 2.5/3 Pro Image via the grsai gateway).

> Personal toolkit for building knowledge-card content (小红书 image cards, infographics, system diagrams). Not a marketplace plugin — install via `git clone + install.sh`.

---

## Attribution

All skill code (workflow design, prompt assembly, references) is the work of **[Jim Liu (宝玉)](https://github.com/JimLiu)** under the [baoyu-skills](https://github.com/JimLiu/baoyu-skills) repository. The original work is released under MIT-0 license (per ClawHub publishing terms in the upstream README).

This fork inherits MIT-0; see `LICENSE`.

## What's different from upstream

### 1. Selected 9 skills, dropped 12

Kept (organized for content production):

| Skill | What it does |
|---|---|
| `image-cards` | Multi-card image series for 小红书 (12 styles × 8 layouts × 3 palettes) |
| `imagine` | Image generation engine (multi-provider) |
| `cover-image` | Article cover image (5 dimensions) |
| `infographic` | Single high-density infographic (21 layouts × 22 styles) |
| `diagram` | Dark-themed SVG diagrams (architecture, flowcharts, mind maps) |
| `format-markdown` | Format/beautify Markdown (frontmatter, headings, lists) |
| `article-illustrator` | Auto-identify positions in articles needing visual aids |
| `url-to-markdown` | Fetch URLs → Markdown (X/YouTube/HN adapters via Chrome CDP) |
| `post-to-wechat` | Publish to WeChat Official Account (article + image-text modes) |

Dropped: `comic`, `compress-image`, `danger-gemini-web`, `danger-x-to-markdown`, `image-gen` (deprecated), `markdown-to-html`, `post-to-weibo`, `post-to-x`, `slide-deck`, `translate`, `xhs-images` (deprecated), `youtube-transcript`.

### 2. Renamed all skills (dropped `baoyu-` prefix)

- `baoyu-image-cards` → `image-cards`
- `baoyu-imagine` → `imagine`
- ...

Invocation is now `/image-cards` instead of `/baoyu-image-cards`. Internal cross-references (e.g., `image-cards` → `imagine` backend resolution) updated accordingly.

The configuration directory namespace **`baoyu-skills/`** is intentionally preserved (e.g., `~/.baoyu-skills/.env`, `~/.config/baoyu-skills/<skill>/EXTEND.md`) for two reasons:
- Backward-compatible with any existing baoyu config
- Keeps the original author's namespace as a form of credit

### 3. Added `grsai` provider to `imagine`

`grsai` ([grsai.ai](https://grsai.ai)) is an Asia-friendly LLM gateway that exposes Google's `nano-banana` family (Gemini 2.5/3 Flash/Pro Image) through a sync API. Unlike direct Google access, **grsai's IP is not subject to data-center blocking** — useful when running from VPS or proxied networks.

New files:
- `skills/imagine/scripts/providers/grsai.ts` — provider implementation (sync mode, `replyType: "json"`)

Patches to:
- `skills/imagine/scripts/types.ts` — added `"grsai"` to `Provider` union, added `default_model.grsai`
- `skills/imagine/scripts/main.ts` — added grsai to provider validation, auto-detect, dispatch, batch loop, EXTEND.md parser, help text

**Usage**:

```bash
# Set GRSAI_API_KEY in ~/.baoyu-skills/.env
echo 'GRSAI_API_KEY=sk-your-key-here' >> ~/.baoyu-skills/.env

# Then call /image-cards or /infographic; they will pick up grsai automatically
# Or force it explicitly:
/image-cards draft.md --style notion --layout dense
```

**Supported grsai models** (via `--model`):
`nano-banana`, `nano-banana-fast`, `nano-banana-2`, `nano-banana-2-cl`, `nano-banana-2-4k-cl`, `nano-banana-pro` (default), `nano-banana-pro-cl`, `nano-banana-pro-vip`, `nano-banana-pro-4k-vip`.

**Reference image support**: yes — passed as base64 data URLs in `images` array.

---

## Install

```bash
git clone https://github.com/SpringShi798/xuanting-content-image-skills.git ~/projects/xuanting-content-image-skills
cd ~/projects/xuanting-content-image-skills
bash install.sh
```

`install.sh` symlinks each `skills/*` directory into `~/.claude/skills/`. Idempotent — safe to re-run after `git pull`.

After installing, **restart Claude Code** (or `/reload-plugins`) to pick up the new skills.

## Update

```bash
cd ~/projects/xuanting-content-image-skills && git pull && bash install.sh
```

## Configuration

Each skill's settings live at:

```
~/.config/baoyu-skills/<skill-name>/EXTEND.md      # XDG-style (preferred)
~/.baoyu-skills/<skill-name>/EXTEND.md             # User home fallback
.baoyu-skills/<skill-name>/EXTEND.md               # Project-local override
```

API keys live in `~/.baoyu-skills/.env` (chmod 600):

```
GRSAI_API_KEY=sk-...
GOOGLE_API_KEY=...        # optional, for direct Gemini
WECHAT_APP_ID=...         # for post-to-wechat
WECHAT_APP_SECRET=...
```

Set `default_provider: grsai` in `~/.config/baoyu-skills/imagine/EXTEND.md` to make grsai the default backend for all image generation.

## Why fork instead of just patching?

The upstream `baoyu-skills` is a marketplace plugin distributed via Claude Code's plugin system. Patching the installed copy would be overwritten on every update. Forking + installing as a plain skill set avoids this friction and gives full control over which skills load and how `imagine` resolves backends.

## Tracking upstream

When `baoyu-skills` upstream releases new features I want, the workflow is:

1. Check [JimLiu/baoyu-skills commits](https://github.com/JimLiu/baoyu-skills/commits/main)
2. Cherry-pick relevant changes manually into this fork
3. Rerun `install.sh`

Not automated — by design, so I can review changes before they affect my content pipeline.

## License

MIT-0 (inherited from baoyu-skills upstream).
