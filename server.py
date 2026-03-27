from flask import Flask

app = Flask(__name__)


@app.route("/", methods=["GET"])
def root():
    return "Hello, World!", 200, {"Content-Type": "text/plain; charset=utf-8"}


@app.route("/evening", methods=["GET"])
def evening_get():
    return "Good evening", 200, {"Content-Type": "text/plain; charset=utf-8"}


@app.route("/evening", methods=["POST"])
def evening_post():
    return "Good evening", 201, {"Content-Type": "text/plain; charset=utf-8"}


@app.route("/morning", methods=["GET"])
def morning_get():
    return "Good morning", 200, {"Content-Type": "text/plain; charset=utf-8"}


@app.route("/morning", methods=["POST"])
def morning_post():
    return "Good morning", 201, {"Content-Type": "text/plain; charset=utf-8"}


if __name__ == "__main__":
    from werkzeug.serving import WSGIRequestHandler

    WSGIRequestHandler.version_string = lambda self: ""
    app.run(host="127.0.0.1", port=3000)
