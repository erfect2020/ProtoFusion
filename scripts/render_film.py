"""Render a presentation of current manuscript images, not an inference recording."""
from pathlib import Path
import hashlib
import json
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
W, H, FPS, SECONDS = 1600, 900, 24, 32
FFMPEG = Path(r'D:\minianaconda\envs\basiccv\Library\bin\ffmpeg.exe')
COLORS = dict(bg='#192b22', ink='#eff2e7', mute='#a2b1a4', line='#405749', green='#c5dd9a', blue='#8fb8ba', orange='#e4ac83')


def font(size, weight=450):
    f = ImageFont.truetype(str(ASSETS / 'fonts/archivo-variable.ttf'), size)
    try:
        f.set_variation_by_axes([weight if a['name'] == b'Weight' else 100 if a['name'] == b'Width' else a['default'] for a in f.get_variation_axes()])
    except (OSError, ValueError):
        pass
    return f


FONTS = {s: font(s, 560 if s >= 40 else 430) for s in [16, 18, 20, 22, 26, 36, 48, 62]}
SOURCE_FILES = [
    'sbc-1-1.webp', 'sbc-1-0.webp', 'sbc-1-3.webp',
    'scene-07-01.webp', 'scene-07-00.webp', 'scene-07-09.webp',
    'pgpr-1-0.webp', 'pgpr-1-1.webp', 'pgpr-1-2.webp', 'pgpr-1-3.webp', 'pgpr-1-4.webp',
    'sbc-3-1.webp', 'sbc-3-0.webp', 'sbc-3-2.webp', 'sbc-3-3.webp',
]
IMAGES = {name: Image.open(ASSETS / name).convert('RGB') for name in SOURCE_FILES}


def text(draw, xy, value, size=22, color='ink'):
    draw.text(xy, value, font=FONTS[size], fill=COLORS.get(color, color))


def panel(canvas, filename, box, label, color='green'):
    x, y, w, h = box
    draw = ImageDraw.Draw(canvas)
    draw.line((x, y-48, x+w, y-48), fill=COLORS[color], width=2)
    text(draw, (x, y-36), label, 20, color)
    image = IMAGES[filename].copy()
    image.thumbnail((w, h), Image.Resampling.LANCZOS)
    draw.rectangle((x, y, x+w, y+h), fill='#112017')
    canvas.paste(image, (x+(w-image.width)//2, y+(h-image.height)//2))


def inspect_details(canvas, chapter, progress):
    """Pair every source-image rectangle with the actual pixels shown below it."""
    files = SOURCE_FILES[:3] if chapter == 0 else SOURCE_FILES[3:6]
    points = [(.68, .655), (.81, .88)] if chapter == 0 else [(.49, .64), (.49, .79)]
    # Hold each detail long enough to read, with a short, deliberate transition.
    mix = max(0, min(1, (progress*8-3)/1.2))
    mix = mix*mix*(3-2*mix)
    cx, cy = [points[0][axis]*(1-mix)+points[1][axis]*mix for axis in range(2)]
    draw = ImageDraw.Draw(canvas)
    for i, name in enumerate(files):
        source = IMAGES[name]
        crop_w = round(source.width/2.5)
        crop_h = round(crop_w*156/470)
        left = round(max(0, min(source.width-crop_w, cx*source.width-crop_w/2)))
        top = round(max(0, min(source.height-crop_h, cy*source.height-crop_h/2)))
        crop = source.crop((left, top, left+crop_w, top+crop_h))
        x = 60+i*505
        canvas.paste(crop.resize((470, 156), Image.Resampling.LANCZOS), (x, 636))
        draw.rectangle((x, 636, x+469, 791), outline=COLORS['green'], width=2)
        fitted = source.copy()
        fitted.thumbnail((470, 300), Image.Resampling.LANCZOS)
        fx, fy = x+(470-fitted.width)//2, 300+(300-fitted.height)//2
        sx, sy = fitted.width/source.width, fitted.height/source.height
        draw.rectangle((fx+left*sx, fy+top*sy, fx+(left+crop_w)*sx, fy+(top+crop_h)*sy), outline=COLORS['green'], width=2)


CHAPTERS = [
    ('Complementary inputs', 'Two sources. A richer view.', 'Visible texture and thermal evidence remain available together.'),
    ('Across conditions', 'The same protocol, in daylight.', 'A shared protocol composes an image-specific prompt for each pair.'),
    ('Prompt refinement', 'Refine the fusion instruction.', 'Three displayed candidates from the manuscript. No accepted round is implied.'),
    ('Source correction', 'Take a second look at the evidence.', 'Structured belief construction supports one conservative correction.'),
]


def base(chapter):
    canvas = Image.new('RGB', (W, H), COLORS['bg'])
    draw = ImageDraw.Draw(canvas)
    text(draw, (60, 34), 'PROTOFUSION', 20, 'green')
    text(draw, (1110, 35), 'A VISUAL GUIDE  /  STILL-IMAGE EVIDENCE', 16, 'mute')
    draw.line((60, 80, 1540, 80), fill=COLORS['line'], width=1)
    title, headline, note = CHAPTERS[chapter]
    text(draw, (60, 108), f'0{chapter+1}   /   {title.upper()}', 18, 'orange')
    text(draw, (60, 150), headline, 62)
    if chapter < 2:
        files = SOURCE_FILES[:3] if chapter == 0 else SOURCE_FILES[3:6]
        for i, (name, label, color) in enumerate(zip(files, ['Visible', 'Infrared', 'ProtoFusion'], ['blue', 'orange', 'green'])):
            panel(canvas, name, (60+i*505, 300, 470, 300), label, color)
            text(draw, (60+i*505, 610), 'LINKED DETAIL  /  HIGHLIGHTED REGION ABOVE', 16, 'green')
        text(draw, (60, 807), note, 18, 'mute')
    elif chapter == 2:
        prompts = ['Increase pedestrian luminance and contrast while preserving visible realism.', 'Enhance pedestrian shapes from IR while preserving their VIS geometry.', 'Use IR for crisp pedestrian boundaries; inject saliency into luminance and contrast.']
        for i in range(3):
            panel(canvas, f'pgpr-1-{i+2}.webp', (60+i*505, 300, 470, 356), f'Displayed candidate {i+1}')
            for j, line in enumerate(textwrap.wrap(prompts[i], 35)):
                text(draw, (60+i*505, 682+j*28), line, 22, 'mute')
        text(draw, (60, 779), 'PROMPT INTENT, CONDENSED FROM THE FIGURE EXCERPTS', 16, 'green')
        text(draw, (60, 806), note, 18, 'mute')
    else:
        for i, (name, label, color) in enumerate(zip(SOURCE_FILES[-4:], ['Visible', 'Infrared', 'PGPR', 'PGPR + SBC'], ['blue', 'orange', 'mute', 'green'])):
            panel(canvas, name, (60+i*380, 325, 340, 258), label, color)
        text(draw, (60, 648), 'Source reliability   →   Cross-modal conflicts   →   Scoped prompt correction', 26, 'green')
        text(draw, (60, 711), note, 26, 'mute')
        text(draw, (60, 764), 'SOURCE ANNOTATIONS ARE RETAINED', 16, 'mute')
    for i, (name, _, _) in enumerate(CHAPTERS):
        x = 60+i*380
        draw.line((x, 840, x+340, 840), fill=COLORS['line'], width=2)
        text(draw, (x, 854), f'0{i+1}  {name}', 16, 'green' if i == chapter else 'mute')
    return canvas


def main():
    bases = [base(i) for i in range(4)]
    poster = bases[0].copy()
    inspect_details(poster, 0, 0)
    poster.save(ASSETS / 'film-poster.webp', quality=90)
    output = ASSETS / 'protofusion-film.mp4'
    command = [str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    for n in range(FPS*SECONDS):
        t = n/FPS
        chapter = min(int(t//8), 3)
        local = (t % 8)/8
        frame = bases[chapter].copy()
        draw = ImageDraw.Draw(frame)
        # The view changes; the source pixels are only proportionally enlarged.
        if chapter < 2:
            inspect_details(frame, chapter, local)
        elif chapter == 2:
            active = min(2, int(local*3))
            x = 60+active*505
            draw.rounded_rectangle((x-6, 294, x+476, 662), radius=3, outline=COLORS['green'], width=3)
        else:
            draw.line((60, 629, 1540, 629), fill=COLORS['line'], width=1)
        x = 60+chapter*380
        draw.line((x, 840, x+int(340*local), 840), fill=COLORS['green'], width=3)
        encoder.stdin.write(frame.tobytes())
    encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError('Video encoding failed')
    provenance = {
        'description': 'Animated presentation of static current-manuscript examples; not recorded inference or new experimental evidence.',
        'source_manuscript': 'Article_Title/sn-article.tex',
        'manuscript_sha256': hashlib.sha256((ROOT.parent / 'Article_Title/sn-article.tex').read_bytes()).hexdigest(),
        'format': 'H.264 / yuv420p / 1600x900 / 24fps / 32 seconds / silent',
        'source_images': {name: hashlib.sha256((ASSETS / name).read_bytes()).hexdigest() for name in SOURCE_FILES},
        'operations': ['Proportional image fitting', 'Typeset presentation captions', 'Actual source-image crops with matching full-image region indicators', 'Candidate focus outlines', 'Chapter progress indicators'],
    }
    (ASSETS / 'film-provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
    print(f'Rendered {output.name}: {output.stat().st_size/1024/1024:.2f} MiB, {SECONDS} seconds', flush=True)


if __name__ == '__main__':
    main()
