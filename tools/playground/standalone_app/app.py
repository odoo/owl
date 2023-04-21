#!/usr/bin/env python3

import threading
import time

from http.server import SimpleHTTPRequestHandler, HTTPServer

httpd = None
def start_server():
    global httpd
    SimpleHTTPRequestHandler.extensions_map['.js'] = 'application/javascript'
    httpd = HTTPServer(('0.0.0.0', 3600), SimpleHTTPRequestHandler)
    httpd.serve_forever()

url = 'http://127.0.0.1:3600'

if __name__ == "__main__":
    print("Owl Application")
    print("---------------")
    print("Server running on: {}".format(url))
    threading.Thread(target=start_server, daemon=True).start()

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            httpd.server_close()
            quit(0)
