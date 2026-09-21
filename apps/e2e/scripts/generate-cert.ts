import selfsigned from "selfsigned";
import fs from "fs/promises";
import path from "path";

const outputDir = path.join(import.meta.dirname, "../src/generated");

const attrs = [{ name: "commonName", value: "example.com" }];
const pems = await selfsigned.generate(attrs);

await fs.writeFile(path.join(outputDir, "key.pem"), pems.private, "utf8");
console.log("Private key saved to key.pem");

await fs.writeFile(path.join(outputDir, "cert.pem"), pems.cert, "utf8");
console.log("Certificate saved to cert.pem");
