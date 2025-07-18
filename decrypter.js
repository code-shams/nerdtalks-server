require("dotenv").config();

function decryptSecretKey() {
    const base64 = process.env.FB_SECRET;
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json);
}

module.exports = decryptSecretKey;