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

const ENCRYPTED_KEYWORD = "ENC";

function isEncodedEncrypted(value) {
  return (value && value.startsWith(ENCRYPTED_KEYWORD + "(") && value.trim().endsWith(")"));
}

 /**
  * Encrypts plaintext using AES-GCM with supplied password, for decryption with aesGcmDecrypt().
  *
  * @param   {String} plaintext - Plaintext to be encrypted.
  * @param   {String} password - Password to use to encrypt plaintext.
  * @param   {Object} { iterations, algorithm, keySize }
  *
  * @returns {Object}  { config, iv, ciphertext, encoded }
  **/
const aesGcmEncrypt = async (plaintext, password, config) => {

  if (!plaintext) {
    return { encoded: ENCRYPTED_KEYWORD + "()" };
  }
  config = config || {};
  config.iterations = config["iterations"] || 100000;
  config.algorithm = config["algorithm"] || "SHA-256";
  config.keySize = config["keySize"] || 256;

  var time = performance.now();
  if (!config.key) {
    config.salt = genRandomBuffer(16);
    config.key = await getPbkdf2Key(password, config);
    config.keyparams= config.iterations + "#"
    + config.algorithm + "#"
    + config.keySize + "#"
    + bufferToBase64(config.salt);
    config.debug && console.debug("Derive: " + Math.round(performance.now() - time) + "ms");
    time = performance.now();
  }
  const iv = genRandomBuffer(12);

  // encode plaintext as UTF-8
  const ptUint8 = new TextEncoder().encode(plaintext);

  // encrypt plaintext using key
  const ciphered = await crypto.subtle.encrypt({name: 'AES-GCM', iv: iv }, config.key, ptUint8);
  config.debug && console.debug("Encrypt: " + Math.round(performance.now() - time) + "ms");

  const encoded = ENCRYPTED_KEYWORD + "("
   + config.keyparams + "#"
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

  var time = performance.now();

  if (b64ciphertext.startsWith(ENCRYPTED_KEYWORD + "(")
      && (b64ciphertext.endsWith(")"))) {

    config = config || {};

    var encoded = b64ciphertext.substring(ENCRYPTED_KEYWORD.length+1, b64ciphertext.length-1);

    if (!encoded) {
      return;
    }

    var params = encoded.split("#");
    config.iv = base64ToBuffer(params[4]);
    b64ciphertext = params[5];

    // remove IV and ciphered text to keep only PBKDF2 params
    encoded = encoded.substring(0,
      encoded.length - params[4].length - b64ciphertext.length - 2);


    // cached key?
    if (!config.key || (config.keyparams != encoded)) {
      config.keyparams = encoded;
      config.iterations = parseInt(params[0]);
      config.algorithm = params[1];
      config.keySize = parseInt(params[2]);
      config.salt = base64ToBuffer(params[3]);

      time = performance.now();
      config.key = await getPbkdf2Key(password, config);
      config.debug && console.debug("Derive: " + Math.round(performance.now() - time) + "ms");
      time = performance.now();
    }
  }
  const ctUint8 = base64ToBuffer(b64ciphertext);
  // decrypt ciphertext using key
  const deciphered = await crypto.subtle.decrypt({name: 'AES-GCM', iv: config.iv }, config.key, ctUint8);
  config.debug && console.debug("Decrypt: " + Math.round(performance.now() - time) + "ms");
  return {
    config: config,
    decoded: new TextDecoder().decode(deciphered)
  }
}

/**
 * Generates a random password in selected characters set
 *
 * @param {Object} config: {size, withNum, withAlpha, withSymbols, allowAmbiguous}
 */
function generatePassword(config) {
  // avoid co-existence of ambiguous chars: 0 o O, i I l L 1
  const num = "23456789";
  const numAmbiguous = "01";
  const alpha = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const alphaAmbiguous = "oOiIlL";
  const symbols = ",.!?;:&=+-*/_";
  var chars = "";
  if (config.withNum) {
    if (!config.withAlpha || config.allowAmbiguous) {
      chars += numAmbiguous;
    }
    chars += num;
  }
  if (config.withAlpha) {
    chars += alpha;
    if (config.allowAmbiguous) {
      chars += alphaAmbiguous;
    }
  }
  if (config.withSymbols) chars += symbols;
  var pwd = "";
  const array = new Uint8Array(config.size*2);
  window.crypto.getRandomValues(array);
  for (let i = config.size; i > 0; i--) {
    var pos = Math.floor((array[i] * (chars.length)) / 256);
    pwd += chars.charAt(pos);
  }
  return pwd;
}
