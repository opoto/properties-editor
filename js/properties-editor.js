/* ---------- Privacy Notice ------------ */

function privacyNotice() {
  var now = new Date();
  var EXPIRATION = Math.round(1000*60*60*24*30.5*12); // 12 months in ms
  if ((!config.privacyNotice) || (now.getTime() > new Date(config.privacyNotice).getTime() + EXPIRATION)) {
    $('body').prepend("\
    <div id='privacy-notice' style='display: none;'>\
      <button id='privacy-notice-close'>Got it!</button>\
      <div>This website uses cookies and browser's local storage to enhance your visit experience. \
      <a href='https://github.com/opoto/properties-editor/blob/master/README.md' id='privacy-notice-more'>Read more</a></div>\
    </div>");
    $("#privacy-notice").show();
    $("#privacy-notice-close").click(function() {
      $("#privacy-notice").hide();
      config.privacyNotice = now.toISOString();
    });
  }
}

/* ---------- Toggle options ------------ */
function toggle(event){
  var id = event.currentTarget.id;
  var op;
  var view;
  if (event.currentTarget.tagName.toUpperCase() == "INPUT") {
    view = $(event.currentTarget).is(":checked");
  }
  $(".toggle-"+id).toggle(view);
}
$(".toggle").click(toggle);

function setCheckspan(element, func) {
  var isChecked = element.attr("value") == "checked";
  var tohide = isChecked ? "checkspan-unchecked" : "checkspan-checked";
  element.find("."+tohide).hide();
  var clickCheckspan = function (event, isDblClick) {
    element.find(".checkspan-unchecked, .checkspan-checked").toggle();
    var wasChecked = element.attr("value") == "checked";
    element.attr("value", wasChecked ? "" : "checked");
    if (func) func(!wasChecked, isDblClick);
  }
  element.click(clickCheckspan);
  element.dblclick(function (event) {
    clickCheckspan(event, true);
  });
}
function isCheckspanSelected(element) {
  var checked = element.attr("value") == "checked";
  return checked;
}
function setCheckspanSelected(element, isSelected) {
  if (isCheckspanSelected(element) != isSelected) {
    element.click();
    return true;
  }
  return false;
}

/* ---------- Status messages ------------ */

function setStatus(msg, options) {
  $("#status-msg").text(msg);
  var statusclass = options && options.class ? options.class : "status-info";
  $("#status-msg").attr("class", statusclass);
  $("#status").fadeIn();
  if (options && options.timeout) {
    setTimeout(function () {
      clearStatus();
    }, 1000 * options.timeout);
  }
}

function clearStatus() {
  $("#status").fadeOut(800);
}

/* ------------------- Encryption ----------------- */

let encdec;
try {
  encdec = new EncDec();
} catch (error) {
  alert("ERROR: Crypto is not supported by your browser. This application cannot execute.")
}

function obf(str) {
  return encdec.bufferToBase64(new TextEncoder().encode("A" + str));
}
function deobf(str) {
  return new TextDecoder().decode(encdec.base64ToBuffer(str)).substring(1);
}

 async function decryptPValue(ciphered) {
  cachedkey.debug = config.debug;
  const decrypted = await encdec.aesGcmDecrypt(ciphered, getEncryptPassword(), cachedkey);
  if (decrypted) {
    cachedkey = {
      key: decrypted.config.key,
      keyparams: decrypted.config.keyparams
    }
    return decrypted.decoded;
  } else {
    return "";
  }
}
async function encryptPValue(cleartxt) {
  const encrypted = await encdec.aesGcmEncrypt(cleartxt, getEncryptPassword(), {
    iterations: config.encIterations,
    keySize: config.encKeySize,
    algorithm: config.encAlgorithm,
    key: cachedkey.key,
    keyparams: cachedkey.keyparams,
    debug: config.debug
  });
  if (encrypted.config) {
    cachedkey = {
      key: encrypted.config.key,
      keyparams: encrypted.config.keyparams
    }
  }
  return encrypted.encoded;
}

function isSensitiveName(name) {
  var nameUC = name.toUpperCase();
  return (nameUC.indexOf("KEY") >= 0 || nameUC.indexOf("PASSWORD") >= 0
    || nameUC.indexOf("PWD") >= 0 || nameUC.indexOf("SECRET") >= 0);
}

/* ---------- Saving Options ------------ */

$("#forgetme").change(function() {
  var forgetme = $("#forgetme").is(":checked");
  if (forgetme) $("#forgetpwd").prop("checked", true);
  $("#forgetpwd").prop("disabled", forgetme);
});

/* ---------- Property file loading ------------ */

function handleFileSelect(event) {
  saveConfig();
  var file = event.target.files[0]; // File object
  var reader = new FileReader();
  reader.onload = function (event) {
    importProperties(this.result, file.name);
  };
  reader.onerror = function (err) {
    setStatus("File loading failed: " + err, {
      class: "status-error",
      timeout: 3
    });
  }
  // Read in the image file as a data URL.
  reader.readAsText(file);
}
$("#file").change(handleFileSelect);


/* ---------- Property URL loading ------------ */

function fetchFromURL(event) {
  saveConfig();
  var url = config.fetchUrl;
  if (!url) {
    return;
  }
  var getOptions = {
    xhrFields: {
      withCredentials: true
    }
  };
  if (config.fetchAuth) {
    getOptions.username = config.fetchUser;
    getOptions.password = getFetchPassword();
  }
  $.ajax(url, getOptions)
  .done(function (data) {
    importProperties(data, url.substring(url.lastIndexOf("/") + 1));
  })
  .fail(function (err) {
    setStatus("File loading failed: " + err.statusText, {
      class: "status-error",
      timeout: 3
    });
  });
}
$("#fetch").click(fetchFromURL);

/* ---------- Parse editor -------------*/

function parseProperties() {
  saveConfig();
  importProperties(config.editor, getName());
}
$("#parse").click(parseProperties);

/* ---------- Property file display ------------ */

function deleteProperties() {
  $("#tprops").empty();
  $("#pname").text("TBD");
  $("#output").hide();
  $("#file").val("");
  addPropertiesHeader();
}

function clearProperties() {
  $("#tprops tr").each(function (idx) {
    $(this).find("tdincl input[type=checkbox]").prop('checked', true);
    $(this).find("tdenc input[type=checkbox]").prop('checked', false);
    $(this).find("input[type=text]").val("");
  });
}

async function importProperties(properties, name) {
  deleteProperties();
  if (name) {
    var slash = name.lastIndexOf("/");
    var dot = name.lastIndexOf(".");
    if (dot <= 0) {
      dot = undefined;
    }
    name = name.substring(slash + 1, dot);
    $("#pname").text(name);
  }
  $("#editor").val(properties);
  var desc = [],
    errnames = "";
  var lines = properties.split('\n');
  for (var i = 0; i < lines.length; i++) {
    // spaces at beggining of line are ignored
    var line = lines[i].trimLeft().replace(/[\n\r]*$/, "");
    while (line.endsWith("\\")) {
      line = line.substring(0, line.length - 1);
      if (i+1 < lines.length) {
        line += lines[++i].trimLeft();
      }
    }
    // assignment can be '=' or ':'
    var eq = line.indexOf("=");
    var col = line.indexOf(":");
    var sep = col > 0 ? ((eq > 0) ? Math.min(eq, col) : col) : eq;
    // comment can start with '#' or '!'
    if (line.startsWith("#") || line.startsWith("!")) {
      // comment line
      desc.push(line.substring(1));
    } else if (sep > 0) {
      // looks like <key,value> pair
      var vname = line.substring(0, sep).trimRight();
      var val= line.substring(sep + 1).trimLeft(); // white spaces at end of line are part of value
      if (config.vtrimr) {
        val = val.trimRight();
      }
      if (vname) {
        if (!await addProperty($("#tprops tr:last-child"), vname, val, desc)) {
          errnames += "  - " + vname + "\n";
        }
      }
      desc = [];
    } else if (line.trim()) {
      // non empty line and invalid
      setStatus("Syntax error, line " + (i + 1) + ": " + line, {
        class: "status-error",
        timeout: 3
      });
      return;
    } else {
      // ignore empty lines
      desc = [];
    }
  }
  if (errnames) {
    alert("Failed to decrypt following properties:\n" + errnames);
  }
}

function addPropertiesHeader() {
  $("#tprops").append("<tr>"
    + "<td id='tdinclh'><input type='checkbox' checked/></td>"
    + "<td id='tdnameh'><input id='namefilter' type='text' placeholder='filter'/></td>"
    + "<td id='tdench'>"
    + "  <span id='encbuth' value='' title='Toggle encryption'>"
    + "    <i class='checkspan-checked icon encrypted'></i>"
    + "    <i class='checkspan-unchecked icon cleartext'></i>"
    + "  </span>"
    + "</td>"
    + "<td id='tdvalueh'><input id='valuefilter' type='text' placeholder='filter'/></td>"
    + "</tr>");
  var ench = $("#encbuth");
  setCheckspan(ench, function (isChecked, isDblClick) {
    var isSelected = isCheckspanSelected(ench);
    $("#tprops tr").each(function(idx, row) {
      if (idx == 0) return; // skip header row
      var name = $(row).find("td.tdname").text();
      var enc = $(row).find(".tdenc .encbut");
      if (!isDblClick || !isSelected || isSensitiveName(name)) {
        setCheckspanSelected(enc, isSelected);
      }
    });
  });
  $("#tdinclh input").change(function (event) {
    var cb = $(".tdincl input");
    cb.prop("checked", event.currentTarget.checked);
    cb.change();
  });

  var filteredClass = "filtered-out";
  $("#namefilter, #valuefilter").keyup(function(e) {
    if ((e.keyCode >= 46) || (e.keyCode == 8) || (e.keyCode == 32)) {
      const namef = $("#namefilter").val().trim();
      const valf = $("#valuefilter").val().trim();

      $("#tprops tr").each(function (idx, row) {
        if (idx == 0) return; // skip header row
        var name = $(row).find("td.tdname").text();
        var value = $(row).find(".tdvalue input[type=text]").val().trimLeft();
        const shown = ((!namef || name.indexOf(namef) >= 0) && (!valf || value.indexOf(valf) >= 0));
        var op = shown ? "removeClass" : "addClass";
        $(row)[op](filteredClass);
        // workaround for browsers (= Safari) who do not collapse properly
        if (!shown && (row.offsetHeight > 0)) { // hidden rows should be hidden!
          $(row).removeClass(filteredClass);
          filteredClass = "filtered-out2";
          $(row).addClass(filteredClass);
        }
      });
    }
  });
}

async function addProperty(appendTo, name, value, desc) {
  var encbut,
   inputclass ="",
   isEncrypted = "unchecked",
   noerror = true;
  if (encdec.isEncodedEncrypted(value)) {
    // value is encrypted
    try {
      value = await decryptPValue(value);
    } catch (err) {
      value = "ERROR - decryption failed";
      noerror = false;
    }
    isEncrypted = "checked";
    // 2. mark as encrypted
    inputclass = "class='encrypted-val'";
  }
  var encbut = "<span class='encbut' value='" + isEncrypted + "' title='Toggle encryption'>"
  + "<i class='checkspan-checked icon encrypted'></i>"
  + "<i class='checkspan-unchecked icon cleartext'></i>"
  + "</span>";
  var input = "<input type='text' value='' " + inputclass + "/>";
  if (desc.length) {
    input += "<br/><span></span>";
  }
  appendTo.after("<tr>"
  + "<td class='tdincl'><input class='incl' type='checkbox' checked/></td>"
  + "<td class='tdname'></td>"
  + "<td class='tdenc'>" + encbut + "</td>"
  + "<td class='tdvalue'>" + input + "</td>"
  + "</tr>");
  var addedRow = appendTo.next();
  var tdName = addedRow.find("td.tdname");
  var inclcb = addedRow.find(".incl");
  var input = addedRow.find("td.tdvalue input");
  var nameCell = addedRow.find("td.tdname");
  // use jquery to set values to avoid XSS
  tdName.text(name);
  tdName.attr("title",name);
  input.val(value);
  var comments = addedRow.find("td.tdvalue span");
  desc.forEach( descLine => {
    comments.append($($.parseHTML("<div></div>")).text(descLine));
  });

  // ------ Row listeners
  tdName.click(function (event) {
    var name = tdName.text();
    name = promptPropertyName(name);
    if (name) {
      tdName.text(name);
      tdName.attr("title", name);
    }
  });
  inclcb.change(function(event) {
    if (inclcb.is(":checked")) {
      nameCell.removeClass("disabled");
      input.prop("readonly", false);
      input.prop("disabled", false);
    } else {
      nameCell.addClass("disabled");
      input.prop("readonly", true);
      input.prop("disabled", true);
    }
  });
  setCheckspan(addedRow.find(".encbut"),function(isChecked) {
    if (isChecked) {
      input.addClass("encrypted-val");
    } else {
      input.removeClass("encrypted-val");
    }
  });
  return noerror;
}

function promptPropertyName(prevName) {
  var name = prompt((prevName ? "Update" : "Enter") + " property name:", prevName);
  return name ? name.trim() : undefined;
}

async function insertNewProperty() {
  // insert a new property line after last selected one
  var name = promptPropertyName();
  if (name) {
    // search last selected property
    var after = $("#tprops .tdincl input[type = checkbox]:checked").last();
    if (after.length == 1) {
      // found it, insert after this row
      after = after.parents("tr");
    } else {
      // no row selected, insert after last row
      var after = $("#tprops tr").last();
    }
    await addProperty(after, name, "", []);
  }
}

function deleteSelectedProperties() {
  // delete all selected properties
  $("#tprops .tdincl input[type = checkbox]:checked").parents("tr").remove();
}

$("#add-row").click(insertNewProperty);
$("#delete-rows").click(deleteSelectedProperties);
$("#clear-form").click(clearProperties);
$("#delete-form").click(deleteProperties);

/* ---------- Property file data collection ------------ */

async function exportProperties() {
  var riskynames = "";
  var errnames = "";
  var properties = "";
  properties += "## Generated by " + window.location + "\n";
  properties += "## Date: " + new Date().toISOString() + "\n\n";
  const rows = $("#tprops tr");
  for (i = 0; i < rows.length; i++) {
    const row = rows[i];
    var isIncluded = $(row).find(".tdincl input[type=checkbox]").is(":checked");
    if (isIncluded) {
      var name = $(row).find("td.tdname").text();
      var value = $(row).find(".tdvalue input[type=text]").val().trimLeft();
      if (config.vtrimr) {
        value = value.trimRight();
      }
      var isEncrypted = isCheckspanSelected($(row).find(".tdenc .encbut"));
      if (isEncrypted) {
        try {
          value = await encryptPValue(value);
        } catch (err) {
          value = "ERROR: encryption failed";
          errnames += "  - " + name + "\n";
        }
      } else {
        if (isSensitiveName(name)) {
          riskynames += "  - " + name + "\n";
        }
      }
      var desc = $(row).find("span").text().trim();
      if (desc) {
        properties += "# " + desc + "\n";
      }
      properties += name + "=" + value + "\n";
    }
  }
  if (errnames) {
    if (!confirm("ERROR while encrypting following properties, continue?\n" + errnames)) {
      return;
    }
  }
  if (riskynames) {
    if (!confirm("Following properties are NOT encrypted, do you confirm?\n" + riskynames)) {
      return;
    }
  }
  return properties;
}

function getName() {
  return $("#pname").text();
}
$("#pname-edit").click(function () {
  var oldname = $("#pname").text();
  var newname = prompt("Change property file name:", oldname);
  newname = newname ? newname.trim() : undefined;
  if (newname) {
    $("#pname").text(newname);
  }
});

/* ---------- Property file saving ------------ */

function download(filename, text) {
  var pom = document.createElement('a');
  pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  pom.setAttribute('download', filename);

  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    pom.dispatchEvent(event);
  } else {
    pom.click();
  }
}

$("#save").click(async function () {
  saveConfig();
  const properties = await exportProperties();
  if (properties && !config.nosave) {
    download(getName() + ".properties", properties);
  }
});

/* ---------- Property file posting ------------ */

function tmpfileUpload(file, deleteFile, onDone, onFail) {
  $.ajax({
    method: deleteFile ? "DELETE" : "POST",
    url: config.postUrl,
    data: file
  }).done(function(resp) {
    onDone(resp.urlAdmin, resp.url);
  }).fail(onFail);
}

$("#post-reset").click(function () {
  saveConfig();
  config.postUrl = DEFAULT_CONFIG.postUrl;
  applyConfig();
});

$("#post-url").click(function () {
  var url;
  var minSz = DEFAULT_CONFIG.postUrl.length + 1; // +1 for potential trailing /
  do {
    url = prompt("Copy or paste the URL from a previous upload.\nWarning: Don't share this link, this is your private admin URL to update or delete the file.", config.postUrl);
    url = url ? url.trim() : url;
    var invalid = url // not empty
      && ((url.indexOf(DEFAULT_CONFIG.postUrl) != 0) // must start with expected server url
      || ((url.length > minSz) && (url.lastIndexOf(".") < minSz)));
    if (invalid) {
      alert("ERROR: the URL is not valid. It must match:\n"
        + DEFAULT_CONFIG.postUrl + "/<public-id>.<admin-secret>");
    }
  } while (invalid);
  if (url) {
    config.postUrl = url;
    applyConfig();
  }
});

$("#post-delete").click(async function () {
  if (!confirm("Permanently delete file on remote shared storage?")) return;
  tmpfileUpload("", true, function() {
    config.postUrl = DEFAULT_CONFIG.postUrl;
    applyConfig();
  }, function(err) {
    alert(err);
  });
});

$("#post").click(async function () {
  saveConfig();
  const properties = await exportProperties();
  if (properties) {
    if (config.nosave) {
      // debug: simulate post done
      onPostDone(undefined, "https://friendpaste.com/2P0OaZhUfBH2mfWJzYkIZb/raw?rev=393530653965");
    } else {
      tmpfileUpload(properties, false, onPostDone, onPostFailed);
    }
  }
});

function onPostDone(adminUrl, rawurl) {
  config.postUrl = adminUrl;
  applyConfig();
  var output = $("#output");
  output.find("input").val(rawurl);
  output.find("img").attr("src", "https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=fff&data=>" + encodeURIComponent(rawurl));
  output.show();
}
copyOnClick("#output input", "#copy-posted-url")

function onPostFailed(err) {
  setStatus("File upload failed: " + err, {
    class: "status-error",
    timeout: 2
  });
}

/* ---------- Display -------------*/

async function displayProperties() {
  saveConfig();
  var properties = await exportProperties();
  if (properties) {
    $("#editor").val("## " + getName() + ".properties\n" + properties);
    saveConfig(); // to save editor area
  }
}
$("#display").click(displayProperties);

$("#clear-editor").click(function() {
  $("#editor").val("");
  saveConfig();
});

setCheckspan($("#vieweditor"), function (isChecked) {
  $("#editor").toggle(isChecked);
});


/* ---------- Config -------------*/

var SAMPLE_NAME = "Sample";
var SAMPLE_EDITOR = `
### Header

# This is a URL
 test.url = https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=fff&data=

    # ignored comment

test.accents= string with accents éèùàçùñ¡

   ! Multiline comment sarting with !
 test.multiline.value  = line1   \\
    line2 \\
line3

# ignored comment

# This a \\
  multiline \\
  comment with ':' assignment
test.multiline.comment : 9879=879

test.xss=' onclick='alert("bomb")'

# This a very secret password: ThisIsMyPassWord1234
# Make sure it is encrypted
my.password=ENC(100000#SHA-1#256#xRtal2iSRIhSN1X83ZViVA==#AVl3VbtqNE0Yp2rb#/TPJI1ipMdzs4xZzVmcWBm8j8SBctlalc/RrCQaiRY4xmMJr)

# Empty encrypted property:
! tag a property to be encrypted, even if not providing a value
my.key=ENC()

# Uncomment to test decryption errors
#bad.enc=ENC(kjhsdf)
key.pub=ENC(100000#SHA-1#256#xRtal2iSRIhSN1X83ZViVA==#J3papw2BPAHJefGR#T685VE6BEKnGxD3UbzDtAOykFYN4lQSNzCzV73hGCBOB9CWii2fx1zcvjDK/Mm1RhwY6lnYbWdN0dIDM30zYbYjV4VkyQPuf8cBDb3jIVoq3R8lR5rvHCFyfu1IolC3xWCEJ81bY7bjvfJtciukB8ufiH+NNjSKqo9rxM3BfFRoHKOpnLXiihx1kQ7wrJk53hKWH680/fYCgoN53zY8z+n7sFoJhHZCxvGWmXeIE6pxxIdvzL9dmsyegl653HNYvI9kKu6F6fI5vyY5sAM5J8q3ywwwwxpyiZNzE9r6G1UqoV7KT/k29Bj6xXbiX6DkjS2yypUVfcqsGLcksuo+EPMLy4wIb1+idVsCp5F6GuOb5Ias+bGvtzwOGtzCOUsOGtenos+0DPlowqv7UIxptpTIDjC0PsRo00QKx4fxyEFFRI7OeAYU+t85axNbYFWwaNST+jZKOtgQXwDN3xvC32CAneqftkESPuTqqOh3SnpNzO6W/wxQY6MyCXSS7ILZYQMWNaMZcpL7cO8Po1AKr7Uu01q/AFrAEUje/WvhEp4Uve6ju2O3q3uc3H4YwOCnGj96iyNnP/jLjspeg52yFvvJ4mgdUemyG6bMX0Zw0+nsW+B1HJWvQ29NTggyArl/sIMo35aQVjuE8Yof2H5Xo/59a7o1W5/uuBFzMkYudDGrZOiynQ/BXVm1d3mrdx+0yW64=)

Base64=zNkh0nLsZXrbWHKeHTKA==
Color=#987AD3

`;

var DEFAULT_CONFIG = {
  obfpassw: obf("p4ssw0rd"),
  forgetme: false,
  forgetpwd: true,
  vtrimr: false,
  pwdSz: "12",
  pwdNum: true,
  pwdAlpha: true,
  pwdSym: true,
  fetchAuth: false,
  postUrl: "https://tmpfile.glitch.me",
  debug: false,
  encIterations: 100000,
  encKeySize: 256,
  encAlgorithm: "SHA-1",
  name: SAMPLE_NAME,
  editor: SAMPLE_EDITOR,
  viewEditor: true
}
var CONFIG_ITEM = "properties-editor.config";
var cachedkey = {};
var config;

function restoreConfig() {
  config = JSON.parse(localStorage.getItem(CONFIG_ITEM));
  var forgetme = false,
      privacyNotice;
  if (config) {
    // keep at least this data
    forgetme = config.forgetme;
    privacyNotice = config.privacyNotice;
  }
  if (!config || forgetme) {
    config = Object.assign({}, DEFAULT_CONFIG);
    config.forgetme = forgetme;
    config.privacyNotice = privacyNotice;
  }
}

function saveConfig() {
  cachedkey = {};

  config.forgetme = $("#forgetme").is(":checked");
  config.forgetpwd = $("#forgetpwd").is(":checked");
  config.vtrimr = $("#vtrimr").is(":checked");

  config.obfpassw = config.forgetpwd ? "" : obf(getEncryptPassword());

  config.pwdSz = $("#pwd-sz").children("option:selected").val();
  config.pwdNum = $("#pwd-num").is(":checked");
  config.pwdAlpha = $("#pwd-alpha").is(":checked");
  config.pwdSym = $("#pwd-sym").is(":checked");

  config.fetchUrl = $("#fetch-url").val().trim();
  config.fetchAuth = $("#fetch-auth").is(":checked");
  config.fetchUser = $("#fetch-user").val().trim();
  config.obfFetchPassw = config.forgetpwd ? "" : obf($("#fetch-password").val().trim());

  config.encIterations = $("#enc-iter").children("option:selected").val();
  config.encAlgorithm = $("#enc-algo").children("option:selected").val();
  config.encKeySize = $("#enc-key-size").children("option:selected").val();

  config.postUrl = $("#post-url").val().trim();

  config.editor = $("#editor").val();
  config.viewEditor = isCheckspanSelected($("#vieweditor"));

  config.name = $("#pname").text();

  if (config.forgetme) {
    localStorage.setItem(CONFIG_ITEM, JSON.stringify({
      forgetme: true,
      privacyNotice : config.privacyNotice
    }));
  } else {
    localStorage.setItem(CONFIG_ITEM, JSON.stringify(config));
  }
}

function applyConfig() {

  if (config.obfpassw) setEncryptPassword(deobf(config.obfpassw));

  $("#forgetme").prop("checked", config.forgetme);
  $("#forgetme").change();
  $("#forgetpwd").prop("checked", config.forgetpwd);
  $("#vtrimr").prop("checked", config.vtrimr);

  $("#pwd-sz").val(config.pwdSz);
  $("#pwd-num").prop("checked", config.pwdNum);
  $("#pwd-alpha").prop("checked", config.pwdAlpha);
  $("#pwd-sym").prop("checked", config.pwdSym);

  $("#enc-iter").val(config.encIterations);
  $("#enc-algo").val(config.encAlgorithm);
  $("#enc-key-size").val(config.encKeySize);

  $("#fetch-url").val(config.fetchUrl);
  $("#fetch-auth").prop("checked", config.fetchAuth);
  config.fetchAuth && $(".toggle-fetch-auth").show();
  $("#fetch-user").val(config.fetchUser);
  if (config.obfFetchPassw) $("#fetch-password").val(deobf(config.obfFetchPassw));

  $("#post-url").val(config.postUrl)
  var showPostOptions = (config.postUrl.lastIndexOf("/") > 10);
  $("#post-reset").toggle(showPostOptions);
  $("#post-delete").toggle(showPostOptions);

  $("#editor").val(config.editor);
  setCheckspanSelected($("#vieweditor"), config.viewEditor);
  $("#pname").text(config.name);

}

function getFetchPassword() {
  return $("#fetch-password").val().trim();
}
function getPostPassword() {
  return $("#post-password").val().trim();
}
function getEncryptPassword() {
  return $("#encrypt-password").val().trim();
}
function setEncryptPassword(pwd) {
  $("#encrypt-password").val(pwd);
}

$("#resetCfg").click(async function() {
  var privacyNotice = config.privacyNotice;
  config = Object.assign({}, DEFAULT_CONFIG);
  applyConfig();
  await importProperties(config.editor, config.name);
  config.privacyNotice = privacyNotice;
  saveConfig();
});

function gaEvent(action, category, label, value) {
  gtag('event', action, {
    'event_category': category,
    'event_label': label,
    'value': value
  });
}

// Log errors
window.onerror = function(messageOrEvent, source, line, row, err) {
  var errmsg = messageOrEvent.toString() + " [" + source + ": " + line + ", " + row + "]";
  console.error(errmsg);
  var label = {
    path: window.location.pathname,
    ua: navigator.userAgent
  };
  if (err && err.stack) {
    label.stack = err.stack;
  }
  if (config.debug) {
    alert(errmsg);
  } else if (gtag) {
    gaEvent('error', errmsg, JSON.stringify(label));
  }
}

/* ------------------- Password ------------------ */

setCheckspan($("#viewpwd"), function(isChecked){
  var type = isChecked ? "text" : "password";
  $("#encrypt-password").attr("type", type);
});
setCheckspan($("#encrypt-options"));

/**
 * Copies the value of an HTML <input> element to the clipboard when another element is clicked
 *
 * @param {string} selector - Selector of the copy button/element
 *    This HTML element MUST HAVE a "data-copyonclick-from" attribute with the id of the input element to copy
 * @param {Object} options - Optional options:
 *    'copyOk': string to display on successful copy (default is "Copied to clipboard")
 *    'copyKO': string to display on successful copy (default is "! Cannot copy !")
 *    'statusDelay': time in ms during which the status message is displayed (default is 1 sec)
 *    'preCopy': function to call before copy (default is none)
 *    'postCopy': function to call after copy (default is none)
 */
 function copyOnClick(selector, options) {

  let copyOk = (options && options.copyOk) || "Copied to clipboard"
  let copyKO = (options && options.copyKO) || "! Cannot copy !"
  let statusDelay = (options && options.statusDelay) || 1000

  function showCopyStatus(clicked, input, statusText) {
    let temp = input.val()
    let type = input.attr("type")
    if (type == "password") {
      input.attr("type", "text")
    } else {
      type = undefined;
    }
    input.val(statusText)

    clicked.prop("disabled", true)
    input.prop("disabled", true)
    setTimeout(function() {
      if (type) {
        input.attr("type", type)
      }
      input.val(temp)
      clicked.prop("disabled", false)
      input.prop("disabled", false)
      if (options && options.postCopy) {
        options.postCopy(input)
      }
    }, statusDelay);
  }

  $(selector).click(function (event) {
    if (event.target.disabled) {
      return
    }
    let clicked = $(event.target)
    let input
    if (event.target.attributes["data-copyonclick-from"]) {
      let inputId = event.target.attributes["data-copyonclick-from"].value
      input = $("#"+inputId)
    }
    if(!input || input.length == 0) {
      console.error("copyOnClick: invalid or missing 'data-copyonclick-from' attribute")
    }
    if (options && options.preCopy) {
      options.preCopy(input)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.val())
      .then(function() { showCopyStatus(clicked, input, copyOk) })
      .catch(function() { showCopyStatus(clicked, input, copyKO) })
    } else {
      input[0].select();
      try {
        document.execCommand("copy")
        showCopyStatus(clicked, input, copyOk)
      } catch(err) {
        showCopyStatus(clicked, input, copyKO)
      }
    }
  })
}
copyOnClick("#copy-password")

$("#generate-password").click(function(event){
  saveConfig();
  $("#encrypt-password").val(encdec.generatePassword({
    size: config.pwdSz,
    withNum: config.pwdNum,
    withAlpha: config.pwdAlpha,
    withSymbols: config.pwdSym,
    alowAmbiguous: false}
  ));
});

// Extract URL parameters from current location
function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null ? undefined: decodeURIComponent(results[1].replace(/\+/g, " "));
}

copyOnClick("#share-url", {
  preCopy: function(input) {
    saveConfig();
    // build shareable link
    var sharedUrl = window.location + "?url=" + encodeURIComponent(config.fetchUrl);
    if (!config.forgetpwd) {
      sharedUrl += "&pwd=" + encodeURIComponent(getEncryptPassword());
    }
    // set shareable link in input box
    input.val(sharedUrl);
  },
  postCopy: function(input) {
    // restore url
    input.val(config.fetchUrl);
  }
});

// run when window loading is completed
$(window).on("load", function() {

  restoreConfig();

  var pwd = getParameterByName("pwd");
  if (pwd) {
    config.obfpassw = obf(pwd);
  }
  var url = getParameterByName("url");
  if (url) {
    config.fetchUrl = url;
  }
  // reset URL if it contains query parameters
  if (window.location.search && window.history && window.history.pushState) {
    window.history.pushState({}, document.title, window.location.pathname);
  }

  applyConfig();
  if (url) {
    $("#fetch").click();
    saveConfig();
  } else {
    importProperties(config.editor, config.name);
  }
  privacyNotice();

  $(window).on("unload", function() {
    // export to editor and save
    displayProperties();
  });
});
