# Refresh reference snapshots only. Review and test changes before any fiscal activation.
import urllib.request, urllib.parse, re, json, hashlib, gzip, base64
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from pathlib import Path
url='https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx'
class Links(HTMLParser):
 def __init__(self): super().__init__();self.links=[]
 def handle_starttag(self,t,attrs):
  if t=='a':
   href=dict(attrs).get('href','')
   if '.xsd' in href.lower():self.links.append(urllib.parse.urljoin(url,href))
page=urllib.request.urlopen(url,timeout=30).read().decode('utf-8','replace');parser=Links();parser.feed(page)
urls=sorted(set(urllib.parse.urlunsplit(urllib.parse.urlsplit(link)._replace(path=urllib.parse.quote(urllib.parse.unquote(urllib.parse.urlsplit(link).path),safe='/'))) for link in parser.links))
def fetch(link):
 data=urllib.request.urlopen(link,timeout=30).read()
 if b'<xs:schema' not in data and b'<xsd:schema' not in data:raise ValueError('Not an XSD')
 filename=urllib.parse.unquote(urllib.parse.urlsplit(link).path.rsplit('/',1)[1])
 return {'name':filename,'version':'1.0','url':link,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'reviewStatus':'reference_only','gzipBase64':base64.b64encode(gzip.compress(data,mtime=0)).decode()}
with ThreadPoolExecutor(max_workers=4) as pool: records=list(pool.map(fetch,urls))
if len(records)<15:raise ValueError(f'Expected official schema set; found {len(records)}')
registry={'source':url,'retrievedAt':datetime.now(timezone.utc).isoformat(),'activation':'reference_only_not_approved_for_emission','records':records}
Path('fiscal/dgii-reference-registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2))
print(json.dumps({'schemas':len(records),'names':[r['name'] for r in records],'bytes':Path('fiscal/dgii-reference-registry.json').stat().st_size}))
