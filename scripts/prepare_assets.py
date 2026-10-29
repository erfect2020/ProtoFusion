"""Build web assets from the current manuscript; no scientific content is synthesized.

Requires pypdf, pypdfium2 and Pillow. FontTools + Brotli are optional.
Run from any directory. Original PDFs and manuscript stay outside the website.
"""
from pathlib import Path
import hashlib
import json
import logging
import re
import urllib.request

from PIL import Image
from pypdf import PdfReader
import pypdfium2 as pdfium

logging.getLogger('pypdf').setLevel(logging.CRITICAL)
SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
SOURCE = ROOT / 'Article_Title'
ASSETS = SITE / 'assets'
ASSETS.mkdir(exist_ok=True)
manifest = {'source': 'Article_Title/sn-article.tex', 'assets': {}}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def record(path, source, detail):
    manifest['assets'][path.relative_to(SITE).as_posix()] = {
        'source': str(source.relative_to(ROOT)).replace('\\', '/'),
        'source_sha256': digest(source), 'extraction': detail,
        'width': Image.open(path).width, 'height': Image.open(path).height,
    }

def save_image(im, name, source, detail, max_width=1000):
    im = im.convert('RGB')
    if im.width > max_width:
        im = im.resize((max_width, round(im.height * max_width / im.width)), Image.Resampling.LANCZOS)
    path = ASSETS / (name + '.webp')
    im.save(path, 'WEBP', quality=93, method=6)
    record(path, source, detail)
    return path.relative_to(SITE).as_posix()

def extract(filename, key, name, max_width=1000):
    src = SOURCE / filename
    im = PdfReader(src).pages[0].images[key].image
    return save_image(im, name, src, f'Embedded image {key}; full image, original aspect ratio.', max_width)

def render(filename, name, width=2000):
    src = SOURCE / filename
    doc = pdfium.PdfDocument(src)
    page = doc[0]
    im = page.render(scale=width/page.get_width()).to_pil()
    path = save_image(im, name, src, 'Full first-page render; all original annotations preserved.', width)
    doc.close()
    return path

def large_images_by_position(filename):
    page = PdfReader(SOURCE / filename).pages[0]
    xo = page['/Resources']['/XObject']
    found = []
    def visitor(op, args, cm, tm):
        if op == b'Do':
            ob = xo.get(args[0])
            if ob and ob.get('/Subtype') == '/Image' and ob.get('/Width', 0) >= 400:
                found.append((round(cm[5], 1), round(cm[4], 1), str(args[0])))
    page.extract_text(visitor_operand_before=visitor)
    return [item[2] for item in sorted(found, key=lambda x: (-x[0], x[1]))]

methods = ['IR', 'VIS', 'CDDFuse', 'DDFM', 'Text-IF', 'C2RF', 'DCEvo', 'Deno-IF', 'LUT-Fuse', 'ProtoFusion']
names = ['Night city', 'Headlight glare', 'Low-light structures', 'Pedestrian walkway', 'Night traffic', 'Bright street',
         'Daytime traffic', 'Tree-lined road', 'Backlit buildings', 'Washed-out facade']
conditions = ['Low light', 'Glare', 'Low light', 'Small targets', 'Mixed illumination', 'Overexposure',
              'Daylight', 'Foliage & vehicles', 'Backlighting', 'Low contrast']
scenes = []
day_keys = large_images_by_position('Fig11_final_visual_day.pdf')
assert len(day_keys) == 40
for row in range(10):
    day = row >= 6
    filename = 'Fig11_final_visual_day.pdf' if day else 'Fig04_trr.pdf'
    frames = {}
    for col, method in enumerate(methods):
        key = day_keys[(row-6)*10+col] if day else f'/Im{row*10+col+1}'
        frames[method] = extract(filename, key, f'scene-{row+1:02}-{col:02}', 900)
    scenes.append({'name': names[row], 'condition': conditions[row], 'images': frames,
                   'figure': 5 if day else 4, 'row': row-5 if day else row+1,
                   'annotation': 'Clean full-image panels; original insets are in the full figure.' if day else 'Original figure annotations and insets are preserved.'})

sbc = []
for i, keys in enumerate([[1,2,3,4],[5,6,7,8],[19,21,23,17],[9,11,13,15]]):
    sbc.append({'name': ['Night city', 'Dark walkway', 'Daytime street', 'Night targets'][i],
                'images': dict(zip(['IR','VIS','PGPR','SBC'], [extract('Fig06_SBC.pdf', f'/Im{k}', f'sbc-{i+1}-{j}') for j,k in enumerate(keys)]))})
    if i >= 2:
        inset_keys = [20,22,24,18] if i == 2 else [10,12,14,16]
        sbc[-1]['insets'] = [extract('Fig06_SBC.pdf', f'/Im{k}', f'sbc-{i+1}-crop-{j}') for j,k in enumerate(inset_keys)]

def infrared_controls():
    """Read the eight columns of the current Figure 6, including its vector annotations."""
    src = SOURCE / 'Fig06_IRControls.pdf'
    page = PdfReader(src).pages[0]
    objects = page['/Resources']['/XObject']
    bands = {}
    def visitor(op, args, cm, tm):
        if op == b'Do' and objects[args[0]].get('/Subtype') == '/Image':
            x, y, width, height = cm[4], cm[5], cm[0], cm[3]
            bands.setdefault(round(y + height / 2), []).append((x, y, width, height))
    page.extract_text(visitor_operand_before=visitor)
    bands = [sorted(bands[y]) for y in sorted(bands, reverse=True)]
    assert [len(band) for band in bands] == [8, 8, 8, 8, 8, 16, 8]
    doc = pdfium.PdfDocument(src)
    scale = 3
    full = doc[0].render(scale=scale).to_pil()
    page_height = float(page.mediabox.height)
    def panel(box, name):
        x, y, width, height = box
        crop = full.crop(tuple(round(v * scale) for v in
                              (x, page_height-y-height, x+width, page_height-y)))
        return save_image(crop, name, src,
                          f'Full panel rendered from PDF rectangle {[round(v, 3) for v in box]}; original annotations preserved.', 900)
    cases = []
    roles = ['VIS', 'IR', 'Shuffled IR', 'Shuffled IR+VIS', 'VIS-only', 'IR+VIS']
    for i in range(8):
        images = {role: panel(bands[row][i], f'ir-control-{i+1}-{j}')
                  for j, (role, row) in enumerate(zip(roles, [0, 1, 2, 3, 4, 6]))}
        insets = [panel(bands[5][i*2+j], f'ir-control-{i+1}-detail-{j}') for j in range(2)]
        cases.append({'name': f'Case {i+1:02}', 'images': images, 'insets': insets})
    doc.close()
    return cases

ir_cases = infrared_controls()

trajectories = []
for row in range(2):
    frames = [extract('Fig05_PGPRv1.pdf', f'/Im{row*5+i+1}', f'pgpr-{row+1}-{i}') for i in range(5)]
    trajectories.append({'name':['Pedestrian boundaries','Scene appearance'][row], 'inputs':frames[:2], 'candidates':frames[2:]})

transfer = []
for row in range(4):
    frames = [extract('Fig13_GPTImage2.pdf', f'/Im{row*8+i+1}', f'transfer-{row+1}-{i}') for i in range(4)]
    transfer.append({'name':f'Case {row+1:02}', 'images':dict(zip(['IR','VIS','Qwen-Image-Edit','GPT Image 2'], frames))})

figures = {}
for filename, key in [('Fig01_state.pdf','overview'),('Fig02_protocoldiagram.pdf','pgpr'),('Fig03_SBCdiagram.pdf','sbc'),
                      ('Fig04_trr.pdf','night'),('Fig11_final_visual_day.pdf','day'),('Fig06_IRControls.pdf','ir'),
                      ('Fig05_PGPRv1.pdf','trajectory'),('Fig06_SBC.pdf','correction'),('Fig13_GPTImage2.pdf','transfer')]:
    figures[key] = render(filename, 'figure-'+key, 2400 if key in ['night','day','ir','correction','transfer'] else 2000)
for filename, key in [('Fig07b_intrinsic_functional_factor_map_pub.png','factor-map'),('Fig07c_control_allocation_profile_matched_style.png','allocation')]:
    figures[key] = save_image(Image.open(SOURCE/filename), 'figure-'+key, SOURCE/filename, 'Whole image, scaled proportionally.', 1800)

tex = re.sub(r'(?<!\\)%[^\n]*', '', (SOURCE/'sn-article.tex').read_text(encoding='utf-8'))
def table(label):
    start = tex.index('\\label{'+label+'}')
    # The appendix table uses captionof inside a minipage rather than a float.
    end = re.search(r'\\end\{(?:table\*?|minipage)\}', tex[start:])
    assert end, label
    return tex[start:start+end.start()]

def rows(block, numeric_start, ncols, labels=None):
    labels = labels or ['CDDFuse','DDFM','TIMFusion','Text-IF','C2RF','DCEvo','Deno-IF','LUT-Fuse','APTP','DPOFusion','DRFusion','ISFuse','ProtoFusion']
    out = []
    for segment in block.split('\\\\'):
        cells = segment.split('&')
        if len(cells) != numeric_start+ncols:
            continue
        method = next((m for m in sorted(labels, key=len, reverse=True) if m in cells[0]), None)
        if not method:
            continue
        vals = [re.search(r'\d+\.\d+', c) for c in cells[numeric_start:]]
        if all(vals):
            row = {'method':method,'values':[float(v.group()) for v in vals]}
            if numeric_start == 2:
                row['venue'] = cells[1].strip()
            out.append(row)
    return out

main = rows(table('tab:main_three_datasets'),2,9)
uni = rows(table('tab:subjective_three_subtables'),2,12)
seg = rows(table('tab:fmb_seg_selected'),2,18)
source_metrics = rows(table('tab:traditional_metrics'),2,9)
budget = rows(table('tab:pgpr_rounds'),1,4,['$T=1$','$T=3$','$T=6$','$T=9$'])
components = rows(table('tab:pgpr_component_ablation'),1,4,
                  ['Human Prompt','Initial Protocol','Principles Only','w/o State Cards','w/o Style Profile','Full PGPR'])
prompt_comparison = rows(table('tab:ablation_sbc'),1,4,
                        ['Human Prompt','VLM-optimized Prompt','PGPR','PGPR+SBC'])
errors = rows(table('tab:fmb-four-category-errors'),1,3,
              ['Content alteration','Geometric distortion','Information omission','Appearance artifacts','Any error'])
assert len(main)==33 and len(uni)==11 and len(seg)==11, (len(main),len(uni),len(seg))
assert [len(source_metrics), len(budget), len(components), len(prompt_comparison), len(errors)] == [13, 4, 6, 4, 5]
data = {'scenes':scenes, 'sbc':sbc, 'irCases':ir_cases,'trajectories':trajectories,'transfer':transfer,'figures':figures,
        'hero':[{'name':s['name'],'images':{'IR':s['images']['IR'],'VIS':s['images']['VIS'],'ProtoFusion':s['images']['SBC']}} for s in sbc[:2]] + [dict(name=s['name'],images={k:s['images'][k] for k in ['IR','VIS','ProtoFusion']}) for s in scenes[6:]],
        'metrics':['IAA','IQA','ISTA','Overall'], 'datasets':['FMB','MSRS','RoadScene'],
        'mainMetrics':['CLIPIQA ↑','MUSIQ ↑','PAQ2PIQ ↑','MANIQA ↑','BRISQUE ↓','TReS ↑','EN ↑','SD ↑','SF ↑'],
        'main':{d:main[i*11:(i+1)*11] for i,d in enumerate(['FMB','MSRS','RoadScene'])},
        'uni':{d:[{**r,'values':r['values'][i*4:(i+1)*4]} for r in uni] for i,d in enumerate(['FMB','MSRS','RoadScene'])},
        'sourceMetrics':['CE ↓','Q_AB/F ↑','VIF ↑'],
        'sourceResults':{d:[{**r,'values':r['values'][i*3:(i+1)*3]} for r in source_metrics] for i,d in enumerate(['FMB','MSRS','RoadScene'])},
        'budget':[{'label':r['method'].replace('$','').replace('=',' = '),'values':r['values']} for r in budget],
        'components':[{'label':r['method'],'values':r['values']} for r in components],
        'promptComparison':prompt_comparison,
        'errorRates':{r['method']:r['values'] for r in errors},
        'seg':seg, 'sizes':{p:[m['width'],m['height']] for p,m in manifest['assets'].items()}}
(SITE/'data.js').write_text('/* Generated from the current Article_Title manuscript. See sources.json. */\nwindow.PROTO_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
manifest['manuscript_sha256'] = digest(SOURCE/'sn-article.tex')
manifest['paper_sha256'] = digest(SOURCE/'sn-article.pdf')
manifest['reference_zip_sha256'] = digest(ROOT/'scr4tch-gh-pages.zip')
manifest['processing'] = 'Full embedded images, whole-figure renders, or complete panel renders preserving PDF annotations; proportional resizing and WebP compression only. No inpainting, recoloring or synthesized outputs.'
manifest['tables'] = ['tab:main_three_datasets','tab:subjective_three_subtables','tab:fmb_seg_selected',
                      'tab:traditional_metrics','tab:pgpr_rounds','tab:pgpr_component_ablation',
                      'tab:ablation_sbc','tab:fmb-four-category-errors']
(SITE/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

fonts = ASSETS/'fonts'
fonts.mkdir(exist_ok=True)
font_path = fonts/'archivo-variable.ttf'
if not font_path.exists():
    urllib.request.urlretrieve('https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf',font_path)
    urllib.request.urlretrieve('https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt',fonts/'OFL.txt')
if not (fonts/'archivo-latin.woff2').exists():
    try:
        from fontTools import subset
        options = subset.Options()
        options.flavor = 'woff2'
        font = subset.load_font(str(font_path), options)
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=list(range(32,383))+list(range(8192,8304))+list(range(8592,8704)))
        sub.subset(font)
        subset.save_font(font, str(fonts/'archivo-latin.woff2'), options)
    except ImportError:
        request = urllib.request.Request('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap', headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'})
        css = urllib.request.urlopen(request, timeout=20).read().decode()
        font_urls = re.findall(r'url\(([^)]+\.woff2)\)', css)
        urllib.request.urlretrieve(font_urls[-1], fonts/'archivo-latin.woff2')

print(f'Built {len(manifest["assets"])} visual assets; 33 benchmark, 33 UniPercept, 39 source-referenced and 11 segmentation rows; all ablations extracted from the current manuscript.')
print(f'Asset total: {sum(p.stat().st_size for p in ASSETS.rglob("*") if p.is_file())/1024/1024:.2f} MiB')
