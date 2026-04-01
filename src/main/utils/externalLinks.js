function isSafeExternalUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

module.exports = {
  isSafeExternalUrl
};
