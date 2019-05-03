import sys
import thread
import webbrowser
import time

import BaseHTTPServer
import SimpleHTTPServer

HOST = '127.0.0.1'
PORT = 8000


class OWLHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/extras/owl.js':
            self.path = '/dist/owl.js'
        return SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)


def start_server():
    httpd = BaseHTTPServer.HTTPServer((HOST, PORT), OWLHandler)
    httpd.serve_forever()


if __name__ == "__main__":
    thread.start_new_thread(start_server, ())
    url = 'http://{0}:{1}/extras'.format(HOST, PORT)
    webbrowser.open_new(url)

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            sys.exit(0)
