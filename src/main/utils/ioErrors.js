const path = require("node:path");

function describeIoError(error) {
  const code = error?.code;
  if (code === "ENOENT") {
    return "The target path no longer exists.";
  }
  if (code === "EACCES" || code === "EPERM") {
    return "Permission was denied.";
  }
  if (code === "EBUSY") {
    return "The file is busy in another application.";
  }
  if (code === "ENOSPC") {
    return "The disk is full.";
  }
  if (code === "EMFILE") {
    return "Too many files are open right now.";
  }

  return String(error?.message || error || "Unknown error.");
}

function buildIoErrorMessage(actionLabel, error, targetPath = "") {
  const targetName = targetPath ? path.basename(targetPath) : "";
  const objectPhrase = targetName ? ` ${targetName}` : "";
  return `Could not ${actionLabel}${objectPhrase}. ${describeIoError(error)}`;
}

module.exports = {
  buildIoErrorMessage,
  describeIoError
};
