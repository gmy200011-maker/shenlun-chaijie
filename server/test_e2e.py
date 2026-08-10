import urllib.request, json, time

def raw_call(method, url, data=None):
    req = urllib.request.Request(
        url, data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json'}, method=method)
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

login = raw_call('POST', 'http://localhost:3001/api/auth/login',
                 {'username': 'moon', 'password': '123456'})
TOKEN = login.get('token', '')
H = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}
print('login ok, token len:', len(TOKEN))

def call(method, url, data=None, timeout=120, retries=4):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(
                url, data=json.dumps(data).encode() if data is not None else None,
                headers=H, method=method)
            return json.loads(urllib.request.urlopen(req, timeout=timeout).read())
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429:
                print(f'  429 rate-limited, backoff {(i+1)*25}s...')
                time.sleep((i + 1) * 25)
            else:
                raise
    raise last

content = (
    "浙江宣传公众号始终秉持说人话、切热点、有态度的理念。近年来，随着移动互联网深度普及，"
    "碎片化阅读成为常态，公众注意力被短视频与算法推荐不断切割，深度政论文章的生存空间受到挤压。"
    "在这样的背景下，政务新媒体如何既保持权威性又赢得年轻受众，成为一道现实考题。"
    "其背后，是传播格局重构、话语方式迭代与公信力重塑等多重因素交织。"
    "要解决这一问题，一方面要转变文风，用平实语言讲清大道理；另一方面要善用融媒体手段，"
    "在互动中建立情感连接。说到底，离不开以人民为中心的创作导向。"
)

r = call('POST', 'http://localhost:3001/api/analyze', {'content': content})
if 'error' in r:
    print('ANALYZE ERROR:', r)
else:
    pa = r.get('phenomenonAnalysis', [])
    so = r.get('solutions', [])
    print('background:', (r.get('background') or '')[:40])
    print('phenomenonAnalysis is list:', isinstance(pa, list), 'len:', len(pa))
    if pa: print('  first point heading:', pa[0].get('heading'))
    print('solutions is list:', isinstance(so, list), 'len:', len(so))
    print('materialCases:', [(c.get('type'), c.get('domain')) for c in r.get('materialCases', [])])
    iq = r.get('interviewQuestion') or {}
    print('interviewQuestion type:', iq.get('type'), '| question:', (iq.get('question') or '')[:30])

    # create article (forwards the full analysis, including interviewQuestion)
    body = dict(r)
    body['title'] = '测试文章-融媒体传播'
    body['content'] = content
    art = call('POST', 'http://localhost:3001/api/articles', body)
    print('saved article id:', art.get('id'))

    iqs = call('GET', 'http://localhost:3001/api/interview-questions')
    print('interview count after save:', len(iqs))
    if iqs:
        print('  saved iq type:', iqs[0].get('type'), '| articleId:', iqs[0].get('articleId'))
