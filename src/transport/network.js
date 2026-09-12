const net = require("net");

/**
 * Opens a raw TCP socket to a network thermal printer (standard ESC/POS port 9100),
 * writes the buffer, and closes. No external library needed.
 */
function sendToNetwork(host, port, buffer, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve(true);
    };

    socket.setTimeout(timeoutMs);
    socket.once("timeout", () => finish(new Error(`Timed out connecting to ${host}:${port}`)));
    socket.once("error", (err) => finish(err));

    socket.connect(port, host, () => {
      socket.write(buffer, (err) => finish(err));
    });
  });
}

module.exports = { sendToNetwork };
