"""Local preview at / and /protofusion/ (GitHub Pages subpath smoke check)."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == '/protofusion':
            self.send_response(301)
            self.send_header('Location', '/protofusion/')
            self.end_headers()
            return
        if self.path.startswith('/protofusion/'):
            self.path = self.path[len('/protofusion'):]
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        # Native video controls need byte ranges for seeking and chapter jumps.
        self._range_remaining = None
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        path = Path(self.translate_path(self.path))
        if not match or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        first, last = match.groups()
        if not first and last:
            start, end = max(0, size-int(last)), size-1
        else:
            start = int(first or 0)
            end = min(int(last) if last else size-1, size-1)
        if not size or start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        stream = path.open('rb')
        stream.seek(start)
        self._range_remaining = end-start+1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self._range_remaining))
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        if self._range_remaining is None:
            return super().copyfile(source, outputfile)
        remaining = self._range_remaining
        while remaining:
            chunk = source.read(min(64*1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'ProtoFusion preview: http://127.0.0.1:{args.port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
