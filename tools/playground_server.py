#!/usr/bin/env python3

import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer

HOST = '127.0.0.1'
PORT = 8000
URL = 'http://{0}:{1}/docs/playground'.format(HOST, PORT)


# We define our own handler here to remap owl.js GET requests to the Owl build
# in dist/.  This is useful for the benchmarks and playground applications.
# With this, we can simply copy the playground folder as is in the gh-page when
# we want to update the playground.
class OWLHandler(SimpleHTTPRequestHandler):
    def do_GET(self): 
        if self.path == '/docs/owl.js' or self.path == '/docs/playground/owl.js':
            self.path = '/dist/owl.es.js'
        return SimpleHTTPRequestHandler.do_GET(self)

    def end_headers(self):
        self.disable_cache_headers()
        SimpleHTTPRequestHandler.end_headers(self)

    def disable_cache_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")


OWLHandler.extensions_map['.js'] = 'application/javascript'

if __name__ == "__main__":
    print("Owl Tools")
    print("---------")
    print("Server running on: {}".format(URL))
    httpd = HTTPServer((HOST, PORT), OWLHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            httpd.server_close()
            quit(0)
