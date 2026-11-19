"""Extract only a product catalog from UCI Online Retail; never emit customer fields."""
import argparse
import hashlib
import io
import json
import re
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
URL = 'https://archive.ics.uci.edu/static/public/352/online+retail.zip'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def prepare(limit=100):
    raw = ROOT / 'data/sources/raw'
    raw.mkdir(parents=True, exist_ok=True)
    archive = raw / 'online-retail.zip'
    if not archive.exists():
        with urllib.request.urlopen(URL, timeout=120) as response:
            archive.write_bytes(response.read())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    with zipfile.ZipFile(archive) as bundle:
        xlsx_name = next(n for n in bundle.namelist() if n.endswith('.xlsx'))
        workbook_bytes = bundle.read(xlsx_name)
    with zipfile.ZipFile(io.BytesIO(workbook_bytes)) as workbook:
        strings = []
        with workbook.open('xl/sharedStrings.xml') as source:
            for _, element in ET.iterparse(source, events=('end',)):
                if element.tag.endswith('}si'):
                    strings.append(''.join(t.text or '' for t in element.findall('.//s:t', NS)))
                    element.clear()
        catalog, rows, excluded = {}, 0, {'cancelled': 0, 'nonpositive': 0, 'invalid_product': 0}
        with workbook.open('xl/worksheets/sheet1.xml') as source:
            for _, row in ET.iterparse(source, events=('end',)):
                if not row.tag.endswith('}row'):
                    continue
                values = {}
                for cell in row.findall('s:c', NS):
                    column = re.sub(r'\d', '', cell.attrib['r'])
                    value = cell.find('s:v', NS)
                    text = value.text if value is not None else ''
                    values[column] = strings[int(text)] if cell.attrib.get('t') == 's' and text else text
                if row.attrib.get('r') == '1':
                    row.clear()
                    continue
                rows += 1
                invoice, code, description = values.get('A', ''), values.get('B', ''), values.get('C', '')
                try:
                    quantity, price = float(values.get('D') or '0'), float(values.get('F') or '0')
                except ValueError:
                    quantity, price = 0, 0
                if invoice.upper().startswith('C'):
                    excluded['cancelled'] += 1
                elif quantity <= 0 or price <= 0:
                    excluded['nonpositive'] += 1
                elif not re.fullmatch(r'[0-9]{5}[A-Za-z]?', code) or not description.strip():
                    excluded['invalid_product'] += 1
                else:
                    catalog.setdefault(code.upper(), description.strip()[:120])
                row.clear()
        products = []
        for code in sorted(catalog)[:limit]:
            # GBP sale prices are not TWD procurement costs. This cost is explicitly synthetic.
            cost = 500 + int(hashlib.sha256(code.encode()).hexdigest()[:8], 16) % 49500
            products.append({'sku': f'UCI-{code}', 'name': catalog[code], 'unit': '件', 'unitCostCents': cost, 'reorderPoint': 10, 'origin': 'PUBLIC_DERIVED', 'sourceKey': f'uci:352:StockCode:{code}'})
    mapping = ROOT / 'data/mappings'
    mapping.mkdir(parents=True, exist_ok=True)
    (mapping / 'uci-catalog.json').write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding='utf-8')
    manifest = {'source': 'Chen, D. (2015). Online Retail. UCI Machine Learning Repository.', 'doi': '10.24432/C5BW33', 'url': URL, 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/', 'downloadSha256': digest, 'xlsxSha256': hashlib.sha256(workbook_bytes).hexdigest(), 'processedAt': datetime.now(timezone.utc).isoformat(), 'rowsRead': rows, 'excluded': excluded, 'distinctEligibleProducts': len(catalog), 'catalogRows': len(products), 'retainedFields': ['StockCode', 'Description'], 'syntheticFields': ['unitCostCents', 'reorderPoint', 'unit'], 'excludedPersonalFields': ['CustomerID', 'Country'], 'transactionsImported': 0}
    (ROOT / 'data/sources/uci-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    assert len(products) == limit and len({p['sku'] for p in products}) == limit
    assert rows == 541909
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=100)
    prepare(parser.parse_args().limit)
