from flask import Flask

app = Flask(__name__)


@app.route("/", methods=["GET"])
def root():
    return "Hello, World!", 200


@app.route("/evening", methods=["GET"])
def evening_get():
    return "Good evening", 200


@app.route("/evening", methods=["POST"])
def evening_post():
    return "Good evening", 201


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000)
