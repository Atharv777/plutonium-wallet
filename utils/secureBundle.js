const { pbkdf2 } = require("crypto");
const { randomBytes, secretbox } = require("tweetnacl");
const bs58 = require("bs58");

async function deriveEncryptionKey(password, salt, iterations, digest) {
    return new Promise((resolve, reject) =>
        pbkdf2(
            password,
            salt,
            iterations,
            secretbox.keyLength,
            digest,
            (err, key) => (err ? reject(err) : resolve(key))
        )
    );
}

async function encryptMnemonic(mnemonic, derivationPath, password) {

    if (password, mnemonic, derivationPath) {

        const plaintext = JSON.stringify({ mnemonic, derivationPath });
        const salt = randomBytes(16);
        const kdf = "pbkdf2";
        const iterations = 100000;
        const digest = "sha256";
        const key = await deriveEncryptionKey(password, salt, iterations, digest);
        const nonce = randomBytes(secretbox.nonceLength);
        const encrypted = secretbox(Buffer.from(plaintext), nonce, key);
        return {
            encrypted: bs58.encode(encrypted),
            nonce: bs58.encode(nonce),
            kdf,
            salt: bs58.encode(salt),
            iterations,
            digest,
        };
    }
    else {
        return null
    }
}

async function decryptMnemonic(password, locked) {
    try {
        if (password && locked) {
            const { encrypted: encodedEncrypted, nonce: encodedNonce, salt: encodedSalt, iterations, digest } = locked

            const encrypted = bs58.decode(encodedEncrypted);
            const nonce = bs58.decode(encodedNonce);
            const salt = bs58.decode(encodedSalt);
            const key = await deriveEncryptionKey(password, salt, iterations, digest);

            const plaintext = secretbox.open(encrypted, nonce, key);
            if (!plaintext) {
                return { status: 400, data: null, msg: "Incorrect password!" };
            }
            const decodedPlaintext = Buffer.from(plaintext).toString();
            const { mnemonic, derivationPath } = JSON.parse(decodedPlaintext);
            return { status: 200, data: { mnemonic, derivationPath }, msg: "Decrypted successfully!" };
        }
        else {
            return { status: 400, data: null, msg: "Invalid arguments provided!" };
        }
    }
    catch (e) {
        return { status: 400, data: null, msg: "An unknown error occurred!" };
    }
}

module.exports = { encryptMnemonic, decryptMnemonic }