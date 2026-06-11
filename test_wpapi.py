import sys; sys.path.insert(0, "api")
import warnings; warnings.filterwarnings("ignore")
from scrapling_bridge import IkiruScraper

s = IkiruScraper("https://03.ikiru.wtf")

# Try WP REST API
for path in [
    '/wp-json/wp/v2/search?search=Naruto',
    '/wp-json/wp/v2/posts?search=Naruto',
    '/wp-json/manga/v1/search?q=Naruto',
]:
    r = s._do_get('https://05.ikiru.wtf' + path)
    print(f"{path}: status={r.status}, text[:300]={r.text[:300]}")
