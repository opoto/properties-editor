# EncDec library

EncDec is a Javascript library to encrypt a clear text with an AES-GCM key derived from a password using PBKDF2. The library uses WebCrypto functions from your browser.

The [library](https://github.com/opoto/properties-editor/blob/master/js/encdec.js) can be included using a simple script tag:

```
<script src="encdec.js"></script>
```

It defines the `encdec` global object to provide the operations below.

## Encryption and decryption

PBKDF2 can be configured with the following options:
- `iterations`: number of iteration
- `algorithm`: "SHA-1" or "SHA-256"
- `keySize`: 128 or 256

For example, encryption can be performed using:

```
const pbkdf2config = {
  iterations: 10000,
  algorithm: "SHA-256",
  keySize: 256
};
const cipher = await encdec.aesGcmEncrypt(clearText, password, pbkdf2config);
```

Encryption output is an encoded string in the form:

```
ENC(iterations#digest#key-size#salt#iv#ciphertext)
```

The salt, IV and cipher text values are base64 encoded. The IV is randomly generated.

Decryption can be performed by passing the generated cipher string and the password:

```
const clearText = await encdec.aesGcmDecrypt(cipher, password);
```

## Password generation

EncDec also includes a simple password generator, with following boolean configurations to specify which characters can be included in the password:

- `withNum`: numeric characters (0 to 9)
- `withAlpha`: alphabetic characters (a to z, lower and upper case)
- `withSymbols`: symbols (,.!?;:&=+-*/_()%@#)
- `allowAmbiguous`: characters which can be visually ambiguous (1iIlL0oO)

For example:

```
const password = encdec.generatePassword({
  size: 12,
  withNum: true,
  withAlpha: true,
  withSymbols: true,
  allowAmbiguous: false,
});
```

## Demo

https://opoto.github.io/properties-editor/encdec.html
