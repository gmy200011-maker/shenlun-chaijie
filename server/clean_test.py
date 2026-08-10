import urllib.request, json

DB = r'C:\Users\86150\WorkBuddy\2026-08-10-12-09-57\server\data\db.json'

def raw_call(method, url, data=None, token=''):
    h = {'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers=h, method=method)
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

login = raw_call('POST', 'http://localhost:3001/api/auth/login',
                 {'username': 'moon', 'password': '123456'})
token = login['token']

# Delete test article #2 (cascades interview questions)
try:
    raw_call('DELETE', 'http://localhost:3001/api/articles/2', token=token)
    print('deleted test article 2')
except Exception as e:
    print('article delete note:', e)

# Remove test quote #1 directly from db
with open(DB, 'r', encoding='utf-8') as f:
    db = json.load(f)
before = len(db.get('quotes', []))
db['quotes'] = [q for q in db.get('quotes', []) if q.get('id') != 1]
after = len(db['quotes'])
with open(DB, 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
print(f'quotes: {before} -> {after}')

print('articles:', len(db['articles']),
      '| interviews:', len(db.get('interviewQuestions', [])),
      '| quotes:', len(db['quotes']))
