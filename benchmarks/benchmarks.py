import sys
import thread
import webbrowser
import time

import BaseHTTPServer, SimpleHTTPServer

def start_server():
    httpd = BaseHTTPServer.HTTPServer(('127.0.0.1', 3600), SimpleHTTPServer.SimpleHTTPRequestHandler)
    httpd.serve_forever()

thread.start_new_thread(start_server,())
url = 'http://127.0.0.1:3600/benchmarks'
webbrowser.open_new(url)

while True:
    try:
        time.sleep(1)
    except KeyboardInterrupt:
        sys.exit(0)
