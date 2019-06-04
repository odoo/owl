import sys
import thread
import webbrowser
import time

import BaseHTTPServer
import SimpleHTTPServer

HOST = '127.0.0.1'
PORT = 8000
URL = 'http://{0}:{1}/extras'.format(HOST, PORT)


# We define our own handler here to remap owl.js GET requests to the Owl build
# in dist/.  This is useful for the benchmarks and playground applications.
# With this, we can simply copy the playground folder as is in the gh-page when
# we want to update the playground.
class OWLHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/extras/owl.js':
            self.path = '/dist/owl.js'
        return SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)


def start_server():
    httpd = BaseHTTPServer.HTTPServer((HOST, PORT), OWLHandler)
    httpd.serve_forever()


if __name__ == "__main__":
    print("Owl Extras")
    print("----------")
    print("Server running on: {}".format(URL))
    thread.start_new_thread(start_server, ())
    webbrowser.open_new(URL)

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            sys.exit(0)
