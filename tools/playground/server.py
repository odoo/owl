#!/usr/bin/env python3

import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer

HOST = '127.0.0.1'
PORT = 8000
URL = 'http://{0}:{1}/playground'.format(HOST, PORT)

# Serve from the repo root
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class OWLHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)

    def do_GET(self):
        # Serve OWL build
        if self.path == '/playground/owl.js':
            self.path = '/packages/owl/dist/owl.es.js'
        # Map playground routes to tools/playground
        elif self.path.startswith('/playground/libs/'):
            self.path = '/tools/playground' + self.path[len('/playground'):]
        elif self.path.startswith('/playground/samples/'):
            self.path = '/tools/playground' + self.path[len('/playground'):]
        elif self.path.startswith('/playground'):
            rest = self.path[len('/playground'):]
            if rest == '' or rest == '/':
                self.path = '/tools/playground/static/index.html'
            elif os.path.exists(os.path.join(REPO_ROOT, 'tools/playground/static' + rest)):
                self.path = '/tools/playground/static' + rest
            elif os.path.exists(os.path.join(REPO_ROOT, 'tools/playground/dist' + rest)):
                self.path = '/tools/playground/dist' + rest
        return SimpleHTTPRequestHandler.do_GET(self)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        SimpleHTTPRequestHandler.end_headers(self)


OWLHandler.extensions_map['.js'] = 'application/javascript'

if __name__ == "__main__":
    print("Owl Playground")
    print("--------------")
    print("Server running on: {}".format(URL))
    httpd = HTTPServer((HOST, PORT), OWLHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            httpd.server_close()
            quit(0)
