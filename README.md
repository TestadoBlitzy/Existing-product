# hao-backprop-test

A minimal Python HTTP server tutorial project powered by [Flask](https://flask.palletsprojects.com/) (v3.x), serving two plain-text endpoints.

## Endpoints

| Endpoint       | Method | Response Body      | Content-Type | Status Code |
|----------------|--------|--------------------|--------------|-------------|
| `/`            | GET    | `Hello, World!\n`  | `text/plain` | 200         |
| `/evening`     | GET    | `Good evening`     | `text/plain` | 200         |

## Getting Started

### Prerequisites

- [Python](https://www.python.org/) >= 3.11

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Start the Server

```bash
python main.py
```

The server will start at **http://127.0.0.1:3000/**.

### Run Tests

```bash
pytest
```

## License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) license.
