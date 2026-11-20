"""tests/tools/song-server.py: the hub's local server plus one extra: PUT saves
a file into tests/analysis-songs/ (only there, plain file names only). Used by
tests/analysis-trial/make-band-songs.html to keep the songs it records.
Run from the repo root: python3 tests/tools/song-server.py 8003
"""
import http.server, os, re, sys
ROOT = os.getcwd()
SONGS = os.path.join(ROOT, 'tests', 'analysis-songs')
class Handler(http.server.SimpleHTTPRequestHandler):
    def do_PUT(self):
        name = self.path.rsplit('/', 1)[-1]
        if not self.path.startswith('/tests/analysis-songs/') or not re.fullmatch(r'[\w.-]+\.(webm|wav|mp3|json)', name):
            self.send_error(403); return
        n = int(self.headers.get('Content-Length', 0))
        with open(os.path.join(SONGS, name), 'wb') as f: f.write(self.rfile.read(n))
        self.send_response(201); self.end_headers()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8003), Handler).serve_forever()
