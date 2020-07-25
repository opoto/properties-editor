# Properties Editor

![Icon](https://raw.githubusercontent.com/opoto/properties-editor/master/img/icon.png)
Online properties file editor with optional encryption of sensitive properties values.

# Overview

Click on the lock to encrypt selected property. Double click on the header lock to encrypt all keys or passwords.
Encryption is using an AES-GCM key, derived from your encryption password using PBKDF2. Password can be randomly generated. Derivation, key size, and password generation can be configured by clicking on the cog icon.

Unchecked properties will not be exported.

Editor at the bottom of the page provides an easy way to view the generated properties file.

This application fully runs in your browser, there is no backend processing of properties or settings.

# Privacy policy

Properties and settings are by default saved into your browser (in localStorage), so that when you reload the page or come back for another visit the editor is restored in the state of your last visit. Note that the encryption password is also saved, in obfuscated form. No properties or password are send to any server, apart when you click on the "Post" button where the properties (not the password) are sent to the configured URL.

If you do not wish the application to store the editor state, check the "Don't save state in browser" option. You can also click the "Reset All" button to restore default settings and edited properties.

Google Analytics cookies allow to monitor usage of this application and report errors. This helps to enhance the editor. No properties values are sent to Google Analytics.

# Encryption mechanisms

The internal encryption library (encdec) uses WebCrypto, and can be reused in other contexts. Check the online [demo](https://opoto.github.io/properties-editor/encdec.html).
