const { URL } = require("node:url");

function safeParseUrl(value) {
  try {
    return new URL(String(value || ""));
  } catch {
    return null;
  }
}

function sameOrigin(left, right) {
  return left.protocol === right.protocol && left.host === right.host;
}

function isAllowedRendererUrl(value, options = {}) {
  const parsed = safeParseUrl(value);
  if (!parsed) {
    return false;
  }

  const devServerUrl = safeParseUrl(options.devServerUrl);
  if (devServerUrl && sameOrigin(parsed, devServerUrl)) {
    return true;
  }

  const productionAppUrl = safeParseUrl(options.productionAppUrl);
  if (productionAppUrl && parsed.href === productionAppUrl.href) {
    return true;
  }

  return false;
}

function getEventSenderUrl(event) {
  return event?.senderFrame?.url || event?.sender?.getURL?.() || "";
}

function isTrustedIpcSender(event, options = {}) {
  return isAllowedRendererUrl(getEventSenderUrl(event), options);
}

module.exports = {
  getEventSenderUrl,
  isAllowedRendererUrl,
  isTrustedIpcSender
};
