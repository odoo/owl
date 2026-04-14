#!/usr/bin/env python3

"""Simple HTTP server for the assembled site in _site/."""

import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer

HOST = '127.0.0.1'
PORT = 8000
SITE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'dist', 'website')


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        SimpleHTTPRequestHandler.end_headers(self)


NoCacheHandler.extensions_map['.js'] = 'application/javascript'

if __name__ == "__main__":
    url = 'http://{}:{}'.format(HOST, PORT)
    print("Serving site from: {}".format(SITE_DIR))
    print("Server running on: {}".format(url))
    httpd = HTTPServer((HOST, PORT), NoCacheHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            httpd.server_close()
            quit(0)
