#!/usr/bin/env python3
"""Partner shops' whole fabric catalogues for the app (Affiliates, Nov 7 2026).

Cat: "set up fabric swatch links to the full catalogue, so the connection is set and we just wait on affiliation".
Every partner shop runs on Shopify, so its public product list (/products.json) has every fabric with its page, price,
photo and description. This reads each shop's list, keeps the dressmaking fabrics in stock, works out what the app
needs to know about each one (fibre, special cloth, weight, drape, width, what it suits, its colour from the swatch
photo) and writes one file per fabric type to public/shops/, loaded by the app only when that type is tapped.

Run it again to refresh prices and stock (the shop's own page always has today's price):
  python3 scripts/shop-catalogue.py fetch   # about 15 minutes: reads the three shops into .shop-cache/
  python3 scripts/shop-catalogue.py colours # about 20 minutes the first time: one small swatch photo per fabric
  python3 scripts/shop-catalogue.py build   # writes public/shops/*.json
"""
import io
import json
import os
import re
import ssl
import sys
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.shop-cache')
OUT = os.path.join(ROOT, 'public', 'shops')

# The shop names match SHOP names in src/engine/shopFabrics.ts, where each shop's affiliate link is set.
# `cart`: the shop's cart counts in whole yards, so Buy can put the exact amount straight in its cart (checked Nov 10
# by adding to each shop's cart). Fashion Fabrics Club sells in quarter yards, so its Buy opens the fabric's page.
SHOPS = {
    'mood': {'name': 'Mood Fabrics', 'host': 'www.moodfabrics.com', 'collection': 'fashion-fabrics', 'cart': True},
    'nydf': {'name': 'NY Designer Fabrics', 'host': 'nydesignerfabrics.com', 'cart': True},
    'ffc': {'name': 'Fashion Fabrics Club', 'host': 'www.fashionfabricsclub.com'},
}

CTX = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None))


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={'User-Agent': 'MaisonTrace-catalogue/1.0'})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.read()


def fetch():
    os.makedirs(CACHE, exist_ok=True)
    for key, shop in SHOPS.items():
        products = {}
        # Shopify stops a list at 25,000 products, so a big shop is read from its whole list and its fabric collection.
        lists = ['/products.json'] + ([f"/collections/{shop['collection']}/products.json"] if shop.get('collection') else [])
        for path in lists:
            for page in range(1, 101):
                try:
                    batch = json.loads(get(f"https://{shop['host']}{path}?limit=250&page={page}"))['products']
                except Exception as e:  # the 25,000 limit, or the end of the list
                    print(key, path, page, e)
                    break
                if not batch:
                    break
                for p in batch:
                    products[p['id']] = p
        json.dump(list(products.values()), open(os.path.join(CACHE, f'{key}.json'), 'w'))
        print(key, len(products), 'products')


def text(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' | ', html or '')).strip()


# --- What each fabric is, from its name and description ---------------------------------------------------------

NOT_DRESSMAKING = re.compile(
    r'upholster|drapery|curtain|home dec|crewel|outdoor|awning|blackout|wallpaper|vinyl tablecloth|batting|interfacing|'
    r'fusible|stabili[sz]er|buckram|trim\b|ribbon|applique|fringe|piping|zipper|button|thread|elastic|webbing|'
    r'tape\b|quilt|precut|fat quarter|panel|felt\b|foam|fleece|minky|swatch card|gift card|pattern\b', re.I)
KNIT = re.compile(r'\bknit\b|jersey|\brib\b|ribbing|interlock|french terry|sweater|ponte|tricot|power mesh|scuba|athletic', re.I)

# The cloths the app treats specially (specialFabrics.ts). First match wins.
SPECIAL = [
    ('sequins', r'sequin|paillette|beaded|bead'),
    ('lace', r'\blace\b|guipure|chantilly|alen[cç]on|corded lace'),
    ('velvet', r'velvet|velveteen|velour'),
    ('corduroy', r'corduroy|pinwale|wide wale|featherwale'),
    ('denim', r'denim'),
    ('leather', r'leather|suede|pleather|lamb ?skin|cow ?hide'),
    ('satin', r'charmeuse|\bsatin\b|duchess|duchesse|peau de soie|sateen'),
    ('sheer', r'chiffon|georgette|organza|organdy|voile|tulle|gazar|marquisette|netting|\bmesh\b|batiste'),
]

# Weight and drape by the kind of cloth, for shops that don't say. First match wins; medium and soft otherwise.
KIND = [
    (r'coating|melton|loden|boiled wool|duffle|mackinaw|blanket|canvas|duck\b|upholstery|heavyweight|heavy weight', 'heavy', 'crisp'),
    (r'tweed|boucl|bouclé|chenille|faux fur|shearling|quilted|bonded|neoprene', 'heavy', 'soft'),
    (r'brocade|jacquard|matelass|cloqu|faille|ottoman|gabardine|suiting|twill|drill|bengaline|denim|corduroy|piqu|ripstop|chino', 'medium', 'crisp'),
    (r'taffeta|shantung|dupioni|dupion|mikado|gazar|organza|organdy|poplin|broadcloth|oxford|shirting|seersucker|eyelet|matka|tafetta', 'light', 'crisp'),
    (r'chiffon|georgette|charmeuse|crepe de chine|cr[eê]pe de chine|habotai|china silk|voile|lawn|batiste|challis|crinkle|gauze|tulle|lingerie|silk satin|stretch satin|rayon|viscose|cupro|modal|tencel|lyocell', 'light', 'fluid'),
    (r'crepe|cr[eê]pe|satin|sateen|velvet|velour|lace|sequin|beaded', 'medium', 'fluid'),
    (r'linen|chambray|flannel|double cloth|double-face|double face|wool|cashmere|alpaca|mohair|camel', 'medium', 'soft'),
]

FIBRE_WORDS = [
    ('silk', r'\bsilk\b'), ('wool', r'wool|cashmere|alpaca|mohair|camel|merino|angora'), ('linen', r'linen|flax|ramie|hemp'),
    ('cotton', r'cotton'), ('viscose', r'viscose|rayon|modal|tencel|lyocell|cupro|bamboo|acetate|triacetate'),
    ('polyester', r'polyester|\bpoly\b|nylon|polyamide|acrylic|microfiber|metallic|lurex'),
]


def fibre_of(content, title):
    """The main fibre: one that is at least 70% of the cloth (stretch fibres aside), else a blend. Without a content
    line, the first fibre named in the title."""
    parts = re.findall(r'(\d{1,3})\s*%\s*([A-Za-z][A-Za-z /-]*)', content or '')
    if parts:
        shares = Counter()
        for pct, name in parts:
            name = name.lower()
            if re.search(r'spandex|elastane|lycra', name):
                continue
            for fibre, pat in FIBRE_WORDS:
                if re.search(pat, name):
                    shares[fibre] += int(pct)
                    break
            else:
                shares['other'] += int(pct)
        total = sum(shares.values()) or 1
        top, share = shares.most_common(1)[0]
        if top != 'other' and share / total >= 0.7:
            return top
        return 'blend'
    for fibre, pat in FIBRE_WORDS:
        if re.search(pat, title, re.I):
            return fibre
    return None


GARMENT_WORDS = [
    ('dress', r'dress|gown|slip'), ('skirt', r'skirt'), ('bodice', r'blouse|top|shirt|button-up|bodice|cami'),
    ('trousers', r'pant|trouser|short|jumpsuit'), ('jacket', r'jacket|blazer|vest|waistcoat'), ('coat', r'coat|outerwear'),
]


def suits_of(weight, drape, projects):
    """What the cloth suits: the shop's own suggested projects when it gives them, else by weight and drape."""
    found = [g for g, pat in GARMENT_WORDS if re.search(pat, projects or '', re.I)]
    if found:
        return found
    if weight == 'light':
        return ['bodice', 'dress', 'skirt'] if drape != 'crisp' else ['bodice', 'dress', 'skirt', 'trousers']
    if weight == 'heavy':
        return ['skirt', 'trousers', 'jacket', 'coat']
    return ['skirt', 'dress', 'trousers', 'bodice', 'jacket']


def width_cm(body):
    m = re.search(r'(?:width|measures)[^0-9]{0,20}(\d{2,3})(?:\.\d+)?\s*(?:"|”|in\b|inch)', body, re.I) or re.search(r'(\d{2,3})\s*(?:"|”)\s*wide', body, re.I)
    if m and 30 <= int(m.group(1)) <= 120:
        return round(int(m.group(1)) * 2.54)
    return None


def field(body, name):
    m = re.search(name + r'\s*:\s*\|?\s*([^|\-]{1,80})', body, re.I)
    return m.group(1).strip() if m else ''


def tag(p, prefix):
    for t in p['tags']:
        if t.lower().startswith(prefix):
            return t.split('_', 1)[1]
    return ''


def yard_variant(p):
    """The by-the-yard variant: not a sample, a half yard or a fixed cut."""
    vs = [v for v in p['variants'] if v['available'] and not re.search(r'sample|swatch|1/2|half|1/4', v['title'] or '', re.I)]
    return vs[0] if vs else None


def describe(key, p):
    shop = SHOPS[key]
    title = p['title'].strip()
    body = text(p.get('body_html'))
    tags = ' '.join(p['tags'])
    if not p.get('images') or not p['handle']:
        return None
    if key == 'mood':
        if 'Department_Fashion Fabrics' not in p['tags'] or p['product_type'] in ('STRTCHKNIT', 'UPHOLSTERY', 'DRAPERY', 'NORTHCOTT', 'FIGO', 'PRECUTS'):
            return None
    if key == 'ffc':
        if p['product_type'] == 'Halves' or re.match(r'\d+(\.\d+)? ?YD PC', title, re.I) or 'category_Apparel Fabric' not in tags:
            return None
    if key == 'nydf' and re.search(r'upholster|drapery|home d[eé]cor|pillow', body + title, re.I):
        return None
    if NOT_DRESSMAKING.search(title) or KNIT.search(title):
        return None
    v = yard_variant(p)
    if not v or float(v['price']) <= 0:
        return None
    special = next((s for s, pat in SPECIAL if re.search(pat, title, re.I)), None)
    weight, drape = next(((w, d) for pat, w, d in KIND if re.search(pat, title, re.I)), ('medium', 'soft'))
    # Fashion Fabrics Club says the weight and drape outright.
    if key == 'ffc':
        w = tag(p, 'weight_').lower()
        weight = {'light': 'light', 'very light': 'light', 'medium': 'medium', 'heavy': 'heavy', 'very heavy': 'heavy'}.get(w, weight)
        d = field(body, 'Drape').lower()
        if d:
            drape = 'fluid' if re.search(r'very good|excellent|fluid', d) else 'crisp' if re.search(r'stiff|crisp|body|none|poor', d) else 'soft'
    content = field(body, 'Content') or field(body, 'Fiber Content') or tag(p, 'content_')
    fibre = fibre_of(content, title)
    if not fibre:
        return None
    projects = field(body, 'Suggested Projects') or field(body, 'End Uses') or ' '.join(t for t in p['tags'] if t.lower().startswith('suitablefor_'))
    if re.match(r'\s*linings?\b', projects, re.I):
        return None
    # The colour's name: Mood puts it after the dash, the others tag it.
    colour = (title.split(' - ', 1)[1] if key == 'mood' and ' - ' in title else tag(p, 'maincolor_') or tag(p, 'color_')).strip()
    # A stock code in place of a colour name ("30334", "8E695") says nothing, so the card says the photo shows it.
    if not re.search(r'[A-Za-z]{3}', colour):
        colour = ''
    name = title.split(' - ', 1)[0] if key == 'mood' else re.sub(r'\s+Fabric$', '', title)
    img = p['images'][0]['src']
    return {
        'id': f"{key}-{p['id']}",
        'name': name[:90],
        'shop': shop['name'],
        'price': round(float(v['price']), 2),
        'fibre': fibre,
        **({'special': special} if special else {}),
        'weight': weight,
        'drape': drape,
        'widthCm': width_cm(body) or 137,
        'colour': colour[:40] or 'As shown',
        'url': f"https://{shop['host']}/products/{p['handle']}",
        'img': img,
        'suits': suits_of(weight, drape, projects),
        # Shopify's add-to-cart link: the yard variant, {qty} filled in by the app (shopFabrics.ts buyLink).
        'cart': f"https://{shop['host']}/cart/add?id={v['id']}&quantity={{qty}}" if shop.get('cart') else '',
        'print': bool(re.search(r'print|floral|stripe|plaid|check|gingham|paisley|polka|dot|ikat|houndstooth|abstract|animal|leopard|zebra|toile', title, re.I)),
    }


def load():
    out = []
    for key in SHOPS:
        path = os.path.join(CACHE, f'{key}.json')
        if not os.path.exists(path):
            continue
        for p in json.load(open(path)):
            if not any(v['available'] for v in p['variants']):
                continue
            d = describe(key, p)
            if d:
                out.append(d)
    return out


# --- Colour: from a small copy of each swatch photo -------------------------------------------------------------

def small(img):
    return img + ('&' if '?' in img else '?') + 'width=48'


def hex_of(img):
    """The swatch's main colour: the middle of the photo (away from labels and edges), grouped into similar shades,
    the biggest group's average."""
    from PIL import Image
    im = Image.open(io.BytesIO(get(small(img), 30))).convert('RGB')
    w, h = im.size
    im = im.crop((w // 4, h // 4, w * 3 // 4, h * 3 // 4))
    px = list(im.getdata())
    groups = {}
    for r, g, b in px:
        groups.setdefault((r >> 5, g >> 5, b >> 5), []).append((r, g, b))
    best = max(groups.values(), key=len)
    r, g, b = (round(sum(c[i] for c in best) / len(best)) for i in range(3))
    return f'#{r:02X}{g:02X}{b:02X}'


def colours():
    path = os.path.join(CACHE, 'colours.json')
    known = json.load(open(path)) if os.path.exists(path) else {}
    todo = [f['img'] for f in load() if f['img'] not in known]
    print(len(todo), 'photos to read')

    def one(img):
        try:
            return img, hex_of(img)
        except Exception:
            return img, None

    with ThreadPoolExecutor(24) as pool:
        for i, (img, hx) in enumerate(pool.map(one, todo)):
            if hx:
                known[img] = hx
            if i % 2000 == 0:
                print(i)
                json.dump(known, open(path, 'w'))
    json.dump(known, open(path, 'w'))


# --- The app's files ------------------------------------------------------------------------------------------

def build():
    known = json.load(open(os.path.join(CACHE, 'colours.json')))
    fabrics = [f for f in load() if f['img'] in known]
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        os.remove(os.path.join(OUT, old))
    groups = {}
    for f in fabrics:
        f['hex'] = known[f['img']]
        # Every fabric is listed under its fibre, and under its special cloth too (denim under Cotton and Denim).
        for t in {f['fibre'], f.get('special')} - {None}:
            groups.setdefault(t, []).append(f)
    counts = {}
    for t, fs in groups.items():
        # Plain cloths first, the shops taken in turn (each shop's cheapest first), so the first screenful shows every
        # shop rather than one shop's sale rail.
        rank = {}
        for f in sorted(fs, key=lambda f: (f['print'], f['shop'], f['price'])):
            key = (f['print'], f['shop'])
            rank[f['id']] = rank.get(key, 0)
            rank[key] = rank.get(key, 0) + 1
        order = {s: i for i, s in enumerate(s['name'] for s in SHOPS.values())}
        fs.sort(key=lambda f: (f['print'], rank[f['id']], order[f['shop']]))
        rows = [[f['id'], f['name'], f['shop'], f['price'], f['fibre'], f.get('special', ''), f['weight'], f['drape'], f['widthCm'],
                 f['colour'], f['hex'], f['url'], f['img'], ','.join(f['suits']), 1 if f['print'] else 0, f['cart']] for f in fs]
        json.dump(rows, open(os.path.join(OUT, f'{t}.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
        counts[t] = len(rows)
    by_shop = Counter(f['shop'] for f in fabrics)
    json.dump({'types': counts, 'shops': by_shop}, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
    print(counts, by_shop, len(fabrics))


if __name__ == '__main__':
    {'fetch': fetch, 'colours': colours, 'build': build}[sys.argv[1]]()
