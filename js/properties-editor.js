
/* ---------- Toggle options ------------ */
function toggle(event){
  var id = event.currentTarget.id;
  var op;
  if (event.currentTarget.tagName.toUpperCase() == "INPUT") {
    op = $(event.currentTarget).is(":checked") ? "show" : "hide";
  } else {
    op = "toggle";
  }
  $(".toggle-"+id)[op]();
}
$(".toggle").click(toggle);

function setCheckspan(element, func) {
  var cs = $(element);
  var isChecked = cs.attr("value") == "checked";
  var tohide = isChecked ? "checkspan-unchecked" : "checkspan-checked";
  cs.find("."+tohide).hide();
  cs.click(function (event){
    cs.find(".checkspan-unchecked, .checkspan-checked").toggle();
    var wasChecked = cs.attr("value") == "checked";
    cs.attr("value", wasChecked ? "" : "checked");
    if (func) func(!wasChecked);
  });
}
function isCheckspanSelected(element) {
  var cs = $(element);
  var checked = cs.attr("value") == "checked";
  return checked;
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
// TODO

 async function decryptPValue(ciphered) {
  try {
    const decrypted = await aesGcmDecrypt(ciphered, getEncryptPassword());
    return decrypted;
  } catch (err) {
    return "ERROR - decryption failed";
  }
}
async function encryptPValue(cleartxt) {
  const encrypted = await aesGcmEncrypt(cleartxt, getEncryptPassword());
  return encrypted.encoded;
}

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
  var url = config.fetchURL;
  if (!url) {
    return;
  }
  var getOptions = {};
  if (config.fetchAuth) {
    getOptions.username = config.fetchUser;
    getOptions.password = getFetchPassword();
  }
  $.get(url, getOptions)
  .done(function (data) {
    importProperties(data, url.substring(url.lastIndexOf("/") + 1));
  })
  .fail(function () {
    setStatus("File loading failed: " + err, {
      class: "status-error",
      timeout: 3
    });
  });
}
$("#fetch").click(fetchFromURL);


/* ---------- Property file display ------------ */


function deleteProperties() {
  $("#tprops").empty();
  $("#pname").text("");
  $("#output").hide();
  $("#file").val("");
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
  var desc;
  var lines = properties.split('\n');
  for (var i = 0; i < lines.length; i++) {
    // spaces at beggining of line are ignored
    var line = lines[i].trimLeft();
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
      desc = line.substring(1);
    } else if (sep > 0) {
      // looks like <key,value> pair
      var vname = line.substring(0, sep).trimRight();
      var val= line.substring(sep + 1).trimLeft(); // white spaces at end of line are part of value
      if (config.vtrimr) {
        val = val.trimRight();
      }
      if (vname) {
        await addProperty(vname, val, desc);
      }
      desc = undefined;
    } else if (line.trim()) {
      // non empty line and invalid
      setStatus("Syntax error, line " + (i + 1) + ": " + line, {
        class: "status-error",
        timeout: 3
      });
      return;
    } else {
      // ignore empty lines
      desc = undefined;
    }
  }
}

async function addProperty(name, value, desc) {
  var encbut,
   inputclass ="",
   isEncrypted = "unchecked";
  if (value && value.startsWith("ENC(") && value.trim().endsWith(")")) {
    // value is encrypted
    value = await decryptPValue(value);
    isEncrypted = "checked";
    // 2. mark as encrypted
    inputclass = "class='encrypted-val'";
  }
  var encbut = "<span class='encbut' value='" + isEncrypted + "'>"
  + "<i class='checkspan-checked icon encrypted'></i>"
  + "<i class='checkspan-unchecked icon cleartext'></i>"
  + "</span>";
  var input = "<input type='text' value='" + value + "' " + inputclass + "/>";
  if (desc) {
    input += "<br/><span>" + desc + "</span>";
  }
  $("#tprops").append("<tr>"
  + "<td class='tdincl'><input type='checkbox' checked/></td>"
  + "<td class='tdname'>"+ name + "</td>"
  + "<td class='tdenc'>" + encbut + "</td>"
  + "<td class='tdvalue'>" + input + "</td>"
  + "</tr>");
  var addedRow = $("#tprops tr:last-child");

  addedRow.find(".tdincl input[type=checkbox]").change(function(event) {
    var nameCell = addedRow.find("td.tdname");
    var input = addedRow.find("td.tdvalue input, td.tdenc input");
    if ($(event.target).is(":checked")) {
      nameCell.removeClass("disabled");
      input.prop("readonly", false);
      input.prop("disabled", false);
    } else {
      nameCell.addClass("disabled");
      input.prop("readonly", true);
      input.prop("disabled", true);
    }
  });
  setCheckspan(addedRow.find(".tdenc .encbut"),function(isChecked) {
    var input = $(event.currentTarget).parents("tr").find("input[type=text]");
    if (isChecked) {
      input.addClass("encrypted-val");
    } else {
      input.removeClass("encrypted-val");
    }
  });
}

$("#clear-form").click(clearProperties);
$("#delete-form").click(deleteProperties);

/* ---------- Property file data collection ------------ */

async function exportProperties() {
  var riskynames = "";
  var properties = "";
  properties += "## Generated by " + window.location + "\n";
  properties += "## Date: " + new Date().toISOString() + "\n\n";
  const rows = $("#tprops tr");
  for (i = 0; i < rows.length; i++) {
    const row = rows[i];
    var isIncluded = $(row).find(".tdincl input[type=checkbox]").is(":checked");
    if (isIncluded) {
      var name = $(row).find("td.tdname").text().trim();
      var value = $(row).find(".tdvalue input[type=text]").val().trimLeft();
      if (config.vtrimr) {
        value = value.trimRight();
      }
      var isEncrypted = isCheckspanSelected($(row).find(".tdenc .encbut"));
      if (isEncrypted) {
        try {
          value = await encryptPValue(value);
        } catch (err) {
          value = "Failed to encrypt";
        }
      } else {
        var nameUC = name.toUpperCase();
        if (nameUC.indexOf("KEY") > 0 || nameUC.indexOf("PASSWORD") > 0
        || nameUC.indexOf("PWD") > 0 || nameUC.indexOf("SECRET") > 0) {
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
  if (riskynames) {
    if (!confirm("Following properties are NOT encrypted, do you confirm?\n" + riskynames)) {
      return;
    }
  }
  if (config.debug) {
    $("#debug").val(getName() + ":\n" + properties);
    $("#debug").show();
  }
  return properties;
}

function getName() {
  return $("#pname").text();
}
$("#pname-edit").click(function () {
  var oldname = $("#pname").text();
  if (oldname) {
    var newname = prompt("Change property file name:", oldname);
    if (newname) {
      $("#pname").text(newname);
    }
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
  const properties = exportProperties();
  if (properties && !config.debug) {
    download(getName() + ".properties", properties);
  }
});

/* ---------- Property file posting ------------ */

function friendpasteUpload(name, data, onDone, onFail) {
  var postOptions = {
    method: "POST",
    url: config.postUrl,
    dataType: "json",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({
      "title": name,
      "snippet": data,
      "password": "dummy",
      "language": "text"
    })
  };
  if (config.postAuth) {
    postOptions.username = config.postUser;
    postOptions.password = getPostPassword();
  }
  $.ajax(postOptions).done(function (resp) {
    if (resp.ok) {
      onDone(resp.url + "?rev=" + resp.rev, resp.url + "/raw?rev=" + resp.rev);
    } else {
      onFail(resp.reason);
    }
  }).fail(onFail);
}

$("#post").click(async function () {
  saveConfig();
  const properties = await exportProperties();
  if (properties) {
    if (config.debug) {
      onPostDone(undefined, "https://friendpaste.com/2P0OaZhUfBH2mfWJzYkIZb/raw?rev=393530653965");
    } else {
      friendpasteUpload(getName(), properties, onPostDone, onPostFailed);
    }
  }
});

function onPostDone(viewurl, rawurl) {
  var output = $("#output");
  output.find("input").val(rawurl);
  output.find("img").attr("src", "https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=fff&data=>" + encodeURIComponent(rawurl));

  output.find("input").click(function(event) {
    event.target.select();
    event.target.setSelectionRange(0, 99999);
    /* Copy the text inside the text field */
    document.execCommand("copy");
    output.find("#notcopied").hide()
    output.find("#copied").show()
    setTimeout(function () {
      output.find("#notcopied").show()
      output.find("#copied").hide()
    }, 2000);
  });
  output.show();
}

function onPostFailed(err) {
  setStatus("File upload failed: " + err, {
    class: "status-error",
    timeout: 2
  });
}

/* ---------- Config -------------*/

var DEFAULT_CONFIG = {
  encrypt: false,
  pwdSz: "12",
  pwdNum: true,
  pwdAlpha: true,
  pwdSym: true,
  vtrimr: false,
  fetchAuth: false,
  postUrl: "https://www.friendpaste.com",
  postAuth: false,
  debug: false
}
var CONFIG_ITEM = "properties-editor.config";

var config = JSON.parse(localStorage.getItem(CONFIG_ITEM)) || DEFAULT_CONFIG;

function saveConfig() {
  config.fetchUrl = $("#fetch-url").val().trim();
  config.fetchAuth = $("#fetch-auth").is(":checked");
  config.fetchUser = $("#fetch-user").val().trim();

  config.vtrimr = $("#vtrimr").is(":checked");

  config.pwdSz = $("#pwd-sz").children("option:selected").val();
  config.pwdNum = $("#pwd-num").is(":checked");
  config.pwdAlpha = $("#pwd-alpha").is(":checked");
  config.pwdSym = $("#pwd-sym").is(":checked");

  config.postUrl = $("#post-url").val().trim();
  config.postAuth = $("#post-auth").is(":checked");
  config.postUser = $("#post-user").val().trim();

  localStorage.setItem(CONFIG_ITEM, JSON.stringify(config))
}

function applyConfig() {
  $("#fetch-url").val(config.fetchUrl);
  $("#fetch-auth").prop("checked", config.fetchAuth);
  config.fetchAuth && $(".toggle-fetch-auth").show();
  $("#fetch-user").val(config.fetchUser);

  $("#vtrimr").prop("checked", config.vtrimr);

  $("#pwd-sz").val(config.pwdSz);
  $("#pwd-num").prop("checked", config.pwdNum);
  $("#pwd-alpha").prop("checked", config.pwdAlpha);
  $("#pwd-sym").prop("checked", config.pwdSym);

  $("#post-url").val(config.postUrl)
  $("#post-auth").prop("checked", config.postAuth);
  config.postAuth && $(".toggle-post-auth").show();
  $("#post-user").val(config.postUser);
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

$("#resetCfg").click(function() {
  config = DEFAULT_CONFIG;
  applyConfig();
  // reload?
  $("input[type=password]").val("");
  $("input[type=checkbox]").change();
  saveConfig();
});

setCheckspan($("#viewpwd"), function(isChecked){
  if (isChecked) {
    $("#encrypt-password").attr("type", "text");
  } else {
    $("#encrypt-password").attr("type", "password");
  }
});
setCheckspan($("#password-options"));

$("#generate-password").click(function(event){
  saveConfig();
  $("#encrypt-password").val(generatePassword(config.pwdSz, config.pwdNum,
      config.pwdAlpha, config.pwdSym));
});

$(window).on("load", function() {

  applyConfig();

  $(window).on("unload", function() {
    saveConfig();
  });
});

/* ---------- Test -------------*/

function test() {
  importProperties(`
### Header

# This is a URL
 test = https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=fff&data=

    # ignored comment

name=this is a dummy string aàçuù

   ! multiline comment sarting with !
 multiline  = line1   \\
    line2 \\
line3

# this a \\
  multiline \\
  comment with ':' assignment
equation.1 : 9879=879

# very secret
my.password=ENC(100000#SHA-256#256#WWzNkh0nLsZXrbWHKeHTKA==#7Ra57/n/bkpV7xi92YdkFw==#DfeWKrYiemNhOMZ2uaRc7vCf0o96loddlJuTIBnZk0heHk5O)

# so secret it's not even written here
my.key=ENC()

`, "just testing");
}

test();
