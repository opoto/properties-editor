/*
 * Simple lib to encrypt / decrypt a text with a password. Encrypted form is base64 encoded.
 * Requires WebCrypto API, TextEncoder/TextDecoder and Promise (>= ES6)
 */


/**
 * Check if required dependencies are available
 */
function isCryptoSupported() {
  var supported = false;
  try {
    supported = crypto && crypto.subtle && crypto.subtle.importKey && crypto.subtle.digest &&
      crypto.getRandomValues && crypto.subtle.encrypt && crypto.subtle.decrypt &&
      TextEncoder && TextDecoder && Promise && atob && btoa &&
      Array && Array.from && Array.prototype.map && Uint8Array && String &&
      String.fromCharCode && Math && Math.random ? true : false;
  } catch (err) {
    error(err);
  }
  return supported;
}

const genRandomBuffer = (len = 16) => {
  const values = window.crypto.getRandomValues(new Uint8Array(len))
  //return Buffer.from(values);
  return values;
}

const bufferToBase64 = (buffer) => {
  // convert to byte array
  var ctArray = Array.from(new Uint8Array(buffer));
  // convert to string
  var ctStr = ctArray.map(function(byte) { return String.fromCharCode(byte); } ).join('');
  // encode binary string to base64
  return ctBase64 = btoa(ctStr);
}


const base64ToBuffer = (b64) => {
  // decode base64 to binary string
  var ctStr = atob(b64);
  // convert to array
  return new Uint8Array(ctStr.match(/[\s\S]/g).map(function(ch) { return ch.charCodeAt(0); } ));// ciphertext as Uint8Array
}

const getPbkdf2Key = async (password, config) => {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: config.salt,
      iterations: config.iterations,
      hash: config.algorithm
    },
    baseKey,
    { name: "AES-GCM", length: config.keySize},
    true,
    [ "encrypt", "decrypt" ]
  );

  return key;
}

 /**
  * Encrypts plaintext using AES-GCM with supplied password, for decryption with aesGcmDecrypt().
  *
  * @param   {String} plaintext - Plaintext to be encrypted.
  * @param   {String} password - Password to use to encrypt plaintext.
  * @param   {Object} { iterations, algorithm, keySize }
  *
  * @returns {Object}  { salt, iv, ciphertext }
  **/
const aesGcmEncrypt = async (plaintext, password, config) => {

  if (!plaintext) {
    return { encoded: "ENC()" };
  }
  config = config || {};
  config.iterations = config["iterations"] || 100000;
  config.algorithm = config["algorithm"] || "SHA-256";
  config.keySize = config["keySize"] || 256;
  config.salt = genRandomBuffer(16);

  const key = await getPbkdf2Key(password, config);
  const iv = genRandomBuffer();

  // encode plaintext as UTF-8
  const ptUint8 = new TextEncoder().encode(plaintext);

  // encrypt plaintext using key
  const ciphered = await crypto.subtle.encrypt({name: 'AES-GCM', iv: iv }, key, ptUint8);

  const encoded = "ENC("
   + config.iterations + "#"
   + config.algorithm + "#"
   + config.keySize + "#"
   + bufferToBase64(config.salt) + "#"
   + bufferToBase64(iv) + "#"
   + bufferToBase64(ciphered) + ")";

  return {
    config: config,
    iv: iv,
    ciphered: ciphered,
    encoded: encoded
  };
}

 /**
  * Decrypts ciphertext encrypted with aesGcmEncrypt() using supplied password.
  *
  * @param   {String} b64ciphertext - Ciphertext to be decrypted in base64,
  *                                   possibly with cipher parameters:
  *                      ENC(iterations#algo#salt#iv#ciphertext)
  *
  * @param   {String} password - Password to use to decrypt ciphertext.
  * @returns {String} Decrypted plaintext.
  *
  * @example
  *   var plaintext = await aesGcmDecrypt(ciphertext, 'pw');
  *   aesGcmDecrypt(ciphertext, 'pw').then(function(plaintext) { console.log(plaintext); });
  */
const aesGcmDecrypt = async (b64ciphertext, password, config) => {

  if (b64ciphertext.startsWith("ENC(")) {
    if (config) {
      throw new Exception("Both config and encoded mode");
    }
    if (b64ciphertext.endsWith(")") && b64ciphertext.length == 5) {
      return "";
    }
    config = {};
    // iterations
    var sep = b64ciphertext.indexOf("#");
    config.iterations = parseInt(b64ciphertext.substring(4, sep));
    // algorithm
    b64ciphertext = b64ciphertext.substring(sep+1);
    sep = b64ciphertext.indexOf("#");
    config.algorithm = b64ciphertext.substring(0, sep);
    // keySize
    b64ciphertext = b64ciphertext.substring(sep+1);
    sep = b64ciphertext.indexOf("#");
    config.keySize = parseInt(b64ciphertext.substring(0, sep));
    // salt
    b64ciphertext = b64ciphertext.substring(sep+1);
    sep = b64ciphertext.indexOf("#");
    config.salt = base64ToBuffer(b64ciphertext.substring(0, sep));
    // iv
    b64ciphertext = b64ciphertext.substring(sep+1);
    sep = b64ciphertext.indexOf("#");
    config.iv = base64ToBuffer(b64ciphertext.substring(0, sep));
    // keep only cipher text
    b64ciphertext = b64ciphertext.substring(sep+1, b64ciphertext.length-1);
  }
  const key = await getPbkdf2Key(password, config);
  const ctUint8 = base64ToBuffer(b64ciphertext);
  // decrypt ciphertext using key
  const deciphered = await crypto.subtle.decrypt({name: 'AES-GCM', iv: config.iv }, key, ctUint8);
  return new TextDecoder().decode(deciphered);
}

function generatePassword(size, withNum, withAlpha, withSymbols) {
  // avoid co-existence of ambiguous chars: 0 o O, i I l L 1
  const num = "23456789";
  const numAmbiguous = "01";
  const alpha = "abcdefghjkmnpqrstuvwxzABCDEFGHJKMNPQRSTUVWXZ";
  const symbols = ",.!?;:&=+-*/_";
  var chars = "";
  if (withNum) {
    if (!withAlpha) {
      chars += numAmbiguous;
    }
    chars += num;
  }
  if (withAlpha) chars += alpha;
  if (withSymbols) chars += symbols;
  var pwd = "";
  for (i = size; i > 0; i--) {
    var rnd = Math.round(Math.random() * chars.length);
    pwd += chars.charAt(rnd);
  }
  return pwd;
}
