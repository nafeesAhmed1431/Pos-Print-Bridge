const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const SHARE_NAME_PATTERN = /^[A-Za-z0-9 _.-]+$/;

/**
 * Sends a raw ESC/POS buffer to a USB (or any Windows-installed) printer via
 * the OS print spooler, using the classic `copy /b` trick against a local
 * printer share. No native addon, no Zadig/libusb driver swap needed.
 *
 * Requirements on the till PC:
 *   1. The printer is installed normally in Windows with a driver.
 *   2. The printer is shared locally (Printer Properties > Sharing > Share
 *      this printer), e.g. share name "ReceiptPrinter".
 *   3. `job.host` (or `job.printerName`) must equal that share name.
 */
function sendToUSB(shareName, buffer) {
  return new Promise((resolve, reject) => {
    if (!SHARE_NAME_PATTERN.test(shareName)) {
      return reject(
        new Error(
          `Invalid printer share name "${shareName}". Only letters, numbers, spaces, "_", "-", "." allowed.`
        )
      );
    }

    const tempFile = path.join(os.tmpdir(), `print-${Date.now()}-${Math.random().toString(16).slice(2)}.prn`);

    fs.writeFile(tempFile, buffer, (writeErr) => {
      if (writeErr) return reject(writeErr);

      const target = `\\\\localhost\\${shareName}`;
      execFile("cmd.exe", ["/d", "/c", "copy", "/b", tempFile, target], (execErr, stdout, stderr) => {
        fs.unlink(tempFile, () => {});
        if (execErr) {
          return reject(new Error(`copy failed for share "${shareName}": ${stderr || execErr.message}`));
        }
        resolve(true);
      });
    });
  });
}

module.exports = { sendToUSB };
