# POS Print Bridge

Small local server that runs on the till PC. The POS web app POSTs raw
ESC/POS bytes to it, and it relays them to a USB or network thermal printer.

No native dependencies, no admin rights, no driver replacement needed.

## Setup

```bash
npm install
npm run gen-cert -- <hostname>   # generates certificates/server.{key,crt}
npm start
```

- HTTP:  `http://localhost:3001`
- HTTPS: `https://localhost:3002` (once a cert exists)

If the POS site is HTTPS, it must call the HTTPS port — browsers block an
HTTPS page from calling a plain HTTP endpoint. Install
`certificates/server.crt` as a trusted root certificate on every
till/tablet/phone that will call this server, otherwise the browser will
warn or block the request.

## Printing

### USB printer

1. Install the printer normally in Windows (driver installed as usual).
2. Share it: printer Properties > Sharing > "Share this printer" — give it
   a name, e.g. `ReceiptPrinter`.
3. Send that exact share name as `host` with `transport: "USB"`.

Bytes are copied to `\\localhost\<share name>` through the normal Windows
print spooler — same mechanism as `copy /b`.

### Network printer

Send the printer's IP with `transport: "NETWORK"` (default port `9100`).

### POST /print

```json
{
  "content": "<base64 ESC/POS bytes>",
  "encoding": "base64",
  "host": "ReceiptPrinter",
  "transport": "USB"
}
```

or:

```json
{
  "content": "<base64 ESC/POS bytes>",
  "encoding": "base64",
  "host": "192.168.1.140",
  "port": 9100,
  "transport": "NETWORK"
}
```

Send `jobs: [...]` instead of a single job to print multiple things in one
request. The response includes a per-job result:

```json
{ "message": "Processed", "results": [{ "host": "...", "ok": true }] }
```

## config.json

Optional. Two things it can do:

**Force one transport for every job**, ignoring what the request says:

```json
{ "transport": "NETWORK" }
```

**Map friendly printer names to real addresses**, so the POS can send
`host: "kitchen"` instead of a raw IP — useful when every restaurant has
printers on a different subnet but the POS code stays the same everywhere:

```json
{
  "printers": {
    "kitchen": "192.168.1.140",
    "bar": { "host": "192.168.1.141", "port": 9100, "transport": "NETWORK" }
  }
}
```

A plain string is shorthand for a network printer on port 9100. Use the
object form to set a custom port or force USB/FILE transport for that name.
Names not found in `printers` are used as-is (a raw IP or USB share name
still works directly, no config needed).

## Testing without a real printer

`transport: "FILE"` dumps the decoded bytes into `runtime/` instead of
printing — good for checking the server/routing/parsing works before
touching hardware:

```bash
curl -X POST http://localhost:3001/print \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"SGVsbG8gcHJpbnRlciE=\",\"encoding\":\"base64\",\"host\":\"test\",\"transport\":\"FILE\"}"
```

Expect: `{"message":"Processed","results":[{"host":"test","ok":true}]}` and
a new file under `runtime/` containing `Hello printer!`.

## Project layout

```
server.js                    entry point — HTTP :3001, HTTPS :3002
src/
  app.js                      express app: cors, morgan, helmet, body-parser
  routes.js                   GET /jobs, POST /print
  controllers/printController.js   job parsing, config lookup, transport dispatch
  transport/usb.js            USB via Windows share + copy /b
  transport/network.js        raw TCP socket to a network printer
scripts/gen-cert.js           generates a free self-signed HTTPS cert
config.json                   optional transport override + printer name map
```
