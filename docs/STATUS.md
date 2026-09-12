# Print Server — Status

Location: `C:\laragon\www\PrintServer`

Rewrite of the vendor's original `PrintServer` (recovered from
`Downloads\PrintServer\server.js` via its embedded sourcemap) as a
dependency-light, free-forever local print bridge for the web POS.

## ⚠️ Blocking issue — do this first

While setting this up, active malware was found running on this machine:
three `node.exe` processes disguised with fake labels (`app-GitHubDesktop-eval`,
`app-vscode-eval`, `NPM`) beaconing to `193.247.144.38`, `eval()`-ing remote
code, and exfiltrating the hostname/username on failure. This is almost
certainly why an `npm install` got stuck (a locked, un-deletable
`node_modules/printer` folder).

**Before doing anything else on this machine:**
1. Disconnect from the network / block outbound to `193.247.144.38`.
2. Do not run `npm install` again until the machine is confirmed clean —
   reinfection is likely if the entry point was a malicious package.
3. Run a full malware scan (Defender full scan, Malwarebytes) and find the
   persistence mechanism (scheduled task, startup entry, compromised global
   npm package) rather than just killing the processes.
4. Rotate any credentials (git, npm, cloud) used on this machine afterwards.

Nothing in this repo was the cause (the code below has zero native
dependencies precisely to avoid this class of problem going forward), but
`npm install` has **not successfully completed** here yet because of it.

## What's done

Full rewrite, plain JS (no TypeScript build step, no webpack), structured as:

```
C:\laragon\www\PrintServer\
├── server.js                    entry point — HTTP :3001, HTTPS :3002
├── src/
│   ├── app.js                   express app: cors, morgan, helmet, body-parser
│   ├── routes.js                GET /jobs, POST /print
│   ├── consts.js                __basedir
│   ├── errorHandler.js          winston logging to logs/error.log
│   ├── controllers/
│   │   └── printController.js   job parsing, transport dispatch, per-job result
│   └── transport/
│       ├── usb.js               USB printer via Windows share + `copy /b`
│       ├── network.js           raw TCP socket to host:port (default 9100)
│       └── (file transport is inlined in printController — dumps raw bytes
│           to runtime/ for debugging, no printer needed)
├── scripts/
│   └── gen-cert.js              generates a free self-signed HTTPS cert
├── config.json                  optional: force a transport for all jobs
├── certificates/                cert output goes here (gitignored)
├── logs/                        access.log / error.log (gitignored)
├── package.json
├── .gitignore
└── README.md                    setup + API docs
```

### Design decisions (and why), vs. the original vendor server

- **USB printing no longer uses `usb`/libusb + Zadig.** The original required
  replacing the printer's Windows driver with WinUSB via Zadig so
  `node-usb` could claim the device directly — fragile, breaks on Windows
  updates, breaks if the driver ever gets reinstalled. The new version
  installs the printer normally in Windows, shares it locally, and sends raw
  ESC/POS bytes with the classic `copy /b file \\localhost\<share>` trick
  through the normal print spooler. No native Node addon, no driver
  replacement, no admin elevation (`gsudo`) needed to run the server.
- **Considered `node-thermal-printer` + `printer` npm package** as a
  middle-ground (OS-driver USB printing via a maintained library). Rejected:
  the `printer` package is old, requires a native `node-gyp` build, and its
  install failed here due to an unrelated dependency conflict
  (`grunt-node-gyp` peer conflict) even before the malware issue surfaced.
  Not worth the fragility for what a five-line `copy /b` call does for free.
- **Network printing** uses Node's built-in `net` module directly — same as
  the original, no library needed, nothing to swap.
- **HTTPS cert is self-generated and free**, via `scripts/gen-cert.js`
  (uses the `selfsigned` npm package). No QZ Tray, no paid certificate —
  matches the earlier decision to avoid recurring cost. The generated
  `certificates/server.crt` must be installed as a trusted root cert on
  every till/tablet that will call this server over HTTPS, same one-time
  step QZ Tray's free path would have required anyway.
- **Per-job success/failure is now returned in the response.** The original
  fired all print jobs with `forEach` and responded `"Sent to printer"`
  immediately, before any job actually completed or failed. This version
  `await`s each job in order and returns
  `{ message, results: [{ host, ok, error? }, ...] }` so the POS frontend
  can actually detect a failed print instead of assuming success.
- **USB share name is validated** (`^[A-Za-z0-9 _.-]+$`) before being used in
  a shell command, since it comes straight from request input — closes a
  command-injection path that a naive `copy /b` wrapper would otherwise
  open.

## What still needs to be done

1. **Get `npm install` to actually complete.** Blocked by the malware issue
   above. Once the machine is clean, `cd C:\laragon\www\PrintServer && npm
   install` should install cleanly — package.json now only lists
   `express`, `body-parser`, `cors`, `helmet`, `morgan`, `winston`
   (runtime) and `selfsigned` (dev, for cert generation). None of these
   need a native build step.
2. **Generate the HTTPS certificate**: `npm run gen-cert -- <your POS
   domain or till hostname>`, then install the resulting
   `certificates/server.crt` as a trusted root certificate on the till PC
   and every tablet/phone that will print.
3. **Share the USB printer(s) in Windows** (Printer Properties > Sharing >
   Share this printer) and note the exact share name — that's what goes in
   the `host` (or `printerName`) field of print requests.
4. **Decide static IPs for network printers** (kitchen, bar, etc. — same as
   the vendor's original setup) and a static/reserved IP for the till PC
   itself, since tablets need a fixed address to reach this server.
5. **Wire the POS frontend** to POST to
   `https://<till-ip>:3002/print` with the job payload (see README.md for
   the exact shape) instead of whatever it currently points at.
6. **Test end-to-end** (see Testing section below) with a real USB printer
   and a real network printer before rollout.
7. **Decide whether to run this as a Windows service** (e.g. via
   `node-windows`, NSSM, or Task Scheduler "run at startup") so it survives
   till PC reboots without someone manually running `npm start`. The
   original used `gsudo node server.js` via `server.bat` — that's no longer
   needed since we don't touch raw USB, but *some* auto-start mechanism
   still is.
8. **Optional hardening**: rate-limiting on `/print`, restricting CORS to
   the actual POS origin(s) instead of wide-open `cors()`, and validating
   `content`/`encoding` more strictly.

## How to test

Once `npm install` has completed:

```
cd C:\laragon\www\PrintServer
npm run gen-cert -- localhost
npm start
```

You should see:
```
Print server running on : http://localhost:3001
Print server running with SSL on : https://localhost:3002
```

### Test FILE transport first (no printer needed)

Confirms the server, routing, and job parsing all work before touching
hardware.

```bash
curl -X POST http://localhost:3001/print \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"SGVsbG8gcHJpbnRlciE=\",\"encoding\":\"base64\",\"host\":\"test\",\"transport\":\"FILE\"}"
```

Expect: `{"message":"Processed","results":[{"host":"test","ok":true}]}` and a
new file under `runtime/` containing the decoded bytes (`Hello printer!`).

### Test USB transport

1. Share the printer in Windows, note the share name (e.g. `ReceiptPrinter`).
2. ```bash
   curl -X POST http://localhost:3001/print \
     -H "Content-Type: application/json" \
     -d "{\"content\":\"SGVsbG8gcHJpbnRlciE=\",\"encoding\":\"base64\",\"host\":\"ReceiptPrinter\",\"transport\":\"USB\"}"
   ```
3. Expect a line printed on the receipt printer, and `ok:true` in the
   response. On failure, check `logs/error.log` — most likely cause is the
   share name not matching exactly, or the printer not actually shared.

### Test NETWORK transport

1. Confirm the printer's IP and that port 9100 is reachable
   (`Test-NetConnection <ip> -Port 9100` in PowerShell, or `telnet <ip>
   9100`).
2. ```bash
   curl -X POST http://localhost:3001/print \
     -H "Content-Type: application/json" \
     -d "{\"content\":\"SGVsbG8gcHJpbnRlciE=\",\"encoding\":\"base64\",\"host\":\"192.168.0.141\",\"port\":9100,\"transport\":\"NETWORK\"}"
   ```
3. Expect a line printed, `ok:true` in the response.

### Test HTTPS + cross-device

1. From another device on the same LAN (a tablet/phone), first install
   `certificates/server.crt` as a trusted root cert.
2. Hit `https://<till-ip>:3002/print` the same way as above from that
   device (or from a page served over HTTPS, to actually reproduce the
   mixed-content scenario the POS will hit in production).
3. Confirm no cert warning and the print succeeds.

### Test multiple jobs in one request

```bash
curl -X POST http://localhost:3001/print \
  -H "Content-Type: application/json" \
  -d "{\"jobs\":[{\"content\":\"SGVsbG8=\",\"encoding\":\"base64\",\"host\":\"test\",\"transport\":\"FILE\"},{\"content\":\"V29ybGQ=\",\"encoding\":\"base64\",\"host\":\"test2\",\"transport\":\"FILE\"}]}"
```

Expect two entries in `results`, one file per job under `runtime/`.
