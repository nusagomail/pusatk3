// Waits (max 60 s) until a URL answers 2xx. Used to start the web worker after the local API.
const url = process.argv[2];
const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  try {
    if ((await fetch(url)).ok) process.exit(0);
  } catch {
    // not up yet
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.error(`Timed out waiting for ${url}`);
process.exit(1);
