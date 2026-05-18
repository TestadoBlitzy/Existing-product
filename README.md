# hao-backprop-test

A minimal Python tutorial server powered by [Flask](https://flask.palletsprojects.com/). This project demonstrates basic HTTP routing with Flask, serving simple text responses across multiple endpoints.

## Prerequisites

- [Python](https://www.python.org/) 3.10 or higher
- pip (included with Python)

## Setup

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Start the server:

   ```bash
   python server.py
   ```

   The server will start listening at **http://127.0.0.1:3000/**.

## Available Endpoints

| Method | Path       | Response Body    | Status Code     |
| ------ | ---------- | ---------------- | --------------- |
| GET    | `/`        | `Hello, World!`  | `200 OK`        |
| GET    | `/evening` | `Good evening`   | `200 OK`        |
| POST   | `/evening` | `Good evening`   | `201 Created`   |
| GET    | `/morning` | `Good morning`   | `200 OK`        |
| POST   | `/morning` | `Good morning`   | `201 Created`   |

> **Note:** POST requests return a `201 Created` status code.

## License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) license.
