# hao-backprop-test

A minimal Python 3 / Flask HTTP server used as a test project for backprop integration. The server responds to all incoming HTTP requests with a plain-text `Hello, World!\n` message.

## Technology Stack

- **Python** 3.12.3 or newer
- **Flask** 3.1.3

## Prerequisites

- Python 3.9 or newer installed
- pip package manager

## Installation

```bash
pip install -r requirements.txt
```

## Usage

Start the server:

```bash
python app.py
```

The server binds to `http://127.0.0.1:3000/` and prints the following startup message to the console:

```
Server running at http://127.0.0.1:3000/
```

## Behavior

Every HTTP request — regardless of method (GET, POST, PUT, DELETE, etc.) or path — returns the same response:

- **Status:** `200 OK`
- **Content-Type:** `text/plain`
- **Body:** `Hello, World!\n`

## Project Info

- **Version:** 1.0.0
- **Author:** hxu
- **License:** MIT
