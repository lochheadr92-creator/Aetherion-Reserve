"""One-off asset pipeline: generate seamless photoreal PBR textures for the 3D world.

Uses Gemini image generation (emergentintegrations, model gemini-3.1-flash-image-preview) to create
albedo textures from the prompts in /app/design_guidelines_3d.md, then post-processes them with
Pillow/numpy: square crop, seamless-ify (half-offset blend), derive normal + roughness maps, and
downscale to budget (albedo <= 1024, normal/roughness <= 512).

Output: /app/frontend/public/textures/<key>_albedo.jpg, <key>_normal.png, <key>_rough.jpg + manifest.json
Idempotent: existing albedo sources in /app/backend/tools/texture_src are reused (no re-generation).

    cd /app/backend && python tools/gen_textures.py            # generate everything missing
    cd /app/backend && python tools/gen_textures.py --only grass soil   # subset
    cd /app/backend && python tools/gen_textures.py --post-only  # re-run post-processing only
"""
import argparse
import asyncio
import base64
import io
import json
import os
import sys
import time

import numpy as np
from dotenv import load_dotenv
from PIL import Image, ImageFilter

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SRC_DIR = os.path.join(os.path.dirname(__file__), 'texture_src')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'textures')
MODEL = 'gemini-3.1-flash-image-preview'

STYLE = (" Photorealistic, seamless tileable texture filling the entire square frame, perfectly flat and even "
         "neutral overcast lighting, no cast shadows, no vignette, no borders, no text, no watermark, no objects.")

# key -> (prompt, albedo_size, normal_strength, base_roughness, kind)
TEXTURES = {
    # ---- ground materials (top-down) ----
    'grass':      ("Seamless tileable photoreal lush green meadow grass ground texture, top-down 90 degree view, short healthy green grass with subtle clover and a few tiny dry blades, natural mid-green colour, no stones, high detail.", 1024, 0.45, 0.92, 'ground'),
    'denseGrass': ("Seamless tileable photoreal dense grass ground texture, top-down view, thick lush green blades and clumps, subtle color variation.", 1024, 0.55, 0.90, 'ground'),
    'soil':       ("Seamless tileable photoreal soil dirt ground texture, top-down view, fine granular brown earth with small pebbles, no footprints.", 1024, 0.50, 0.95, 'ground'),
    'sand':       ("Seamless tileable photoreal pale sand ground texture, top-down view, fine sand with subtle ripples, no shells.", 1024, 0.35, 0.98, 'ground'),
    'rock':       ("Seamless tileable photoreal rocky ground texture, top-down view, grey small stones and fractured rock slabs.", 1024, 0.95, 0.78, 'ground'),
    'gravel':     ("Seamless tileable photoreal gravel ground texture, top-down view, mixed small grey-beige gravel stones compacted.", 1024, 0.75, 0.88, 'ground'),
    'mud':        ("Seamless tileable photoreal dark mud ground texture, top-down view, wet muddy earth, no directional highlights.", 1024, 0.55, 0.97, 'ground'),
    'wetland':    ("Seamless tileable photoreal wetland ground texture, top-down view, dark damp soil with mossy patches and tiny reed debris.", 1024, 0.50, 0.93, 'ground'),
    'moss':       ("Seamless tileable photoreal moss ground texture, top-down view, dense green moss carpet with subtle variation.", 1024, 0.60, 0.90, 'ground'),
    'fungal':     ("Seamless tileable photoreal alien fungal ground texture, top-down view, dark violet-black organic mat with subtle fibrous patterns and tiny pale specks.", 1024, 0.65, 0.86, 'ground'),
    'alien':      ("Seamless tileable photoreal alien aetheric soil texture, top-down view, deep blue-green mineral soil with faint pale seaglass veins.", 1024, 0.60, 0.84, 'ground'),
    'path':       ("Seamless tileable photoreal dark concrete paver path texture, top-down view, subtle seams and wear.", 1024, 0.55, 0.72, 'ground'),
    'cliff':      ("Seamless tileable photoreal layered sediment cliff rock texture, straight-on view, grey-brown strata with cracks.", 1024, 1.05, 0.80, 'wall'),
    # ---- flora / structures ----
    'bark':       ("Seamless tileable photoreal tree bark texture, straight-on view, deep furrows, grey-brown.", 512, 0.90, 0.88, 'wall'),
    'leaves':     ("Seamless tileable photoreal dense leaf canopy texture, top-down view, mixed green leaves, lush.", 512, 0.55, 0.72, 'ground'),
    'steel':      ("Seamless tileable photoreal galvanized steel sheet texture, straight-on view, no rust blobs.", 512, 0.60, 0.55, 'wall'),
    'darksteel':  ("Seamless tileable photoreal dark brushed steel industrial panel texture, straight-on view, subtle wear and bolts.", 512, 0.65, 0.50, 'wall'),
    'concrete':   ("Seamless tileable photoreal architectural concrete texture, straight-on view, subtle pores, light grey, no graffiti.", 512, 0.65, 0.86, 'wall'),
    'roofing':    ("Seamless tileable photoreal dark industrial standing-seam metal roofing texture, straight-on view.", 512, 0.60, 0.78, 'wall'),
    # ---- creature skins (neutral grey so species colours tint them) ----
    'skin_scales':  ("Seamless tileable photoreal reptile scale skin texture, straight-on macro view, medium scales, neutral desaturated grey, even lighting.", 512, 0.75, 0.62, 'skin'),
    'skin_leather': ("Seamless tileable photoreal thick elephant-like leathery skin texture with fine wrinkles and pores, straight-on macro view, neutral desaturated grey.", 512, 0.55, 0.72, 'skin'),
    'skin_chitin':  ("Seamless tileable photoreal beetle chitin exoskeleton texture with fine segments and micro dimples, straight-on macro view, neutral desaturated grey.", 512, 0.85, 0.38, 'skin'),
    'skin_crystal': ("Seamless tileable photoreal faceted crystal mineral surface texture, straight-on view, sharp facets, neutral desaturated grey.", 512, 0.95, 0.18, 'skin'),
    'skin_gel':     ("Seamless tileable photoreal translucent gel membrane texture with soft bubbles and veins, straight-on macro view, neutral desaturated grey.", 512, 0.35, 0.22, 'skin'),
    'skin_membrane': ("Seamless tileable photoreal bat wing membrane skin texture with fine veins, straight-on macro view, neutral desaturated grey.", 512, 0.40, 0.55, 'skin'),
    'skin_fur':     ("Seamless tileable photoreal short dense animal fur texture, straight-on macro view, neutral desaturated grey.", 512, 0.50, 0.85, 'skin'),
}


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


async def generate(key, prompt):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.getenv('EMERGENT_LLM_KEY')
    if not api_key:
        raise RuntimeError('EMERGENT_LLM_KEY missing in backend/.env')
    chat = LlmChat(api_key=api_key, session_id=f'tex-{key}-{int(time.time())}',
                   system_message='You generate seamless tileable PBR albedo textures for a 3D game. Output only the image.')
    chat.with_model('gemini', MODEL).with_params(modalities=['image', 'text'])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt + STYLE))
    if not images:
        raise RuntimeError(f'no image returned for {key}: {str(text)[:120]}')
    return base64.b64decode(images[0]['data'])


def square(img):
    w, h = img.size
    s = min(w, h)
    return img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))


def make_seamless(arr):
    """Blend the image with a half-offset copy, weighting the copy towards the borders."""
    h, w = arr.shape[:2]
    rolled = np.roll(np.roll(arr, h // 2, axis=0), w // 2, axis=1)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.maximum(np.abs(xx / (w - 1) - 0.5), np.abs(yy / (h - 1) - 0.5)) * 2.0  # 0 centre .. 1 edge
    wgt = np.clip((d - 0.35) / 0.55, 0, 1) ** 1.6
    wgt = wgt[..., None]
    out = arr * (1 - wgt) + rolled * wgt
    return out


def normal_map(lum, strength):
    """Height (luminance) -> tangent-space normal map (OpenGL convention, +Y up)."""
    lum = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255.0
    dx = (np.roll(lum, -1, axis=1) - np.roll(lum, 1, axis=1)) * strength * 6.0
    dy = (np.roll(lum, -1, axis=0) - np.roll(lum, 1, axis=0)) * strength * 6.0
    nz = np.ones_like(lum)
    n = np.stack([-dx, dy, nz], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def post_process(key, src_path, albedo_size, strength, base_rough, kind):
    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.open(src_path).convert('RGB')
    img = square(img).resize((1024, 1024), Image.LANCZOS)
    arr = make_seamless(np.asarray(img, dtype=np.float32))
    if kind == 'skin':
        # neutralise colour so species tints read cleanly, keep detail
        g = arr.mean(axis=-1, keepdims=True)
        arr = arr * 0.25 + g * 0.75
        # normalise brightness to mid grey
        arr = np.clip(arr * (150.0 / max(1.0, arr.mean())), 0, 255)
    albedo = Image.fromarray(arr.astype(np.uint8))
    if albedo_size != 1024:
        albedo = albedo.resize((albedo_size, albedo_size), Image.LANCZOS)
    albedo.save(os.path.join(OUT_DIR, f'{key}_albedo.jpg'), quality=78 if albedo_size >= 1024 else 84, optimize=True)

    lum = (arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114) / 255.0
    small = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS), dtype=np.float32) / 255.0
    Image.fromarray(normal_map(small, strength)).save(os.path.join(OUT_DIR, f'{key}_normal.jpg'), quality=88)
    # roughness: base +/- 0.12 following inverse luminance (bright grains a touch smoother)
    rough = np.clip(base_rough + (0.5 - small) * 0.24, 0.05, 1.0)
    Image.fromarray((rough * 255).astype(np.uint8)).save(os.path.join(OUT_DIR, f'{key}_rough.jpg'), quality=80)


def water_normal():
    """Procedural ripple normal map (AI output is unreliable for normal maps)."""
    n = 512
    rng = np.random.default_rng(7)
    h = np.zeros((n, n), dtype=np.float32)
    yy, xx = np.mgrid[0:n, 0:n] / n * 2 * np.pi
    for k in range(18):
        fx, fy = rng.integers(2, 9), rng.integers(2, 9)
        ph = rng.uniform(0, 2 * np.pi)
        h += np.sin(xx * fx + yy * fy + ph) / (fx + fy)
    h = (h - h.min()) / (h.max() - h.min())
    Image.fromarray(normal_map(h, 0.9)).save(os.path.join(OUT_DIR, 'water_normal.jpg'), quality=90)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--post-only', action='store_true')
    args = ap.parse_args()
    os.makedirs(SRC_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    keys = args.only or list(TEXTURES.keys())
    manifest = {}
    for key in keys:
        prompt, size, strength, rough, kind = TEXTURES[key]
        src = os.path.join(SRC_DIR, f'{key}.png')
        if not os.path.exists(src):
            if args.post_only:
                log('skip (no source)', key); continue
            for attempt in range(3):
                try:
                    log('generate', key)
                    data = await generate(key, prompt)
                    Image.open(io.BytesIO(data)).convert('RGB').save(src)
                    break
                except Exception as e:  # noqa: BLE001
                    log('  retry', key, str(e)[:160])
                    await asyncio.sleep(4 + attempt * 6)
            else:
                log('FAILED', key); continue
        post_process(key, src, size, strength, rough, kind)
        manifest[key] = { 'albedo': f'{key}_albedo.jpg', 'normal': f'{key}_normal.jpg', 'rough': f'{key}_rough.jpg', 'size': size, 'kind': kind }
        log('done', key)
    water_normal()
    mpath = os.path.join(OUT_DIR, 'manifest.json')
    prev = {}
    if os.path.exists(mpath):
        try:
            prev = json.load(open(mpath))
        except Exception:  # noqa: BLE001
            prev = {}
    prev.update(manifest)
    json.dump(prev, open(mpath, 'w'), indent=1)
    log('manifest', len(prev), 'textures')


if __name__ == '__main__':
    asyncio.run(main())
