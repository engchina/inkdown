function isExternalSource(value) {
  return /^(https?:|data:|blob:)/i.test(String(value || "").trim());
}

function isFileUrl(value) {
  return /^file:/i.test(String(value || "").trim());
}

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function isWindowsDrivePath(value) {
  return /^[A-Za-z]:[\\/]/.test(String(value || ""));
}

function isAbsoluteAssetPath(value) {
  const normalized = String(value || "");
  return isWindowsDrivePath(normalized) || normalized.startsWith("\\\\");
}

function isAbsoluteRootPath(value) {
  const normalized = String(value || "");
  return isWindowsDrivePath(normalized) || normalized.startsWith("/") || normalized.startsWith("\\\\");
}

function ensureDirectoryPath(value) {
  const normalized = normalizeSlashes(value).replace(/\/+$/, "");
  return normalized ? `${normalized}/` : "/";
}

function toFileSystemUrl(filePath) {
  const normalized = normalizeSlashes(filePath);
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("//")) {
    return `file:${encodeURI(normalized)}`;
  }
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`;
  }
  return `file://${encodeURI(normalized.startsWith("/") ? normalized : `/${normalized}`)}`;
}

function fromFileSystemUrl(fileUrl) {
  const parsed = new URL(String(fileUrl || ""));
  const decodedPathname = decodeURIComponent(parsed.pathname || "");

  if (parsed.host) {
    return `//${parsed.host}${decodedPathname}`;
  }

  if (/^\/[A-Za-z]:\//.test(decodedPathname)) {
    return decodedPathname.slice(1);
  }

  return decodedPathname;
}

function joinFileSystemRoot(rootPath, assetPath) {
  const rootUrl = toFileSystemUrl(ensureDirectoryPath(rootPath));
  const relativeAssetPath = normalizeSlashes(assetPath).replace(/^\/+/, "");
  return fromFileSystemUrl(new URL(relativeAssetPath, rootUrl).href);
}

export function resolveTyporaRootUrlAsset(assetPath, rootUrl) {
  const source = String(assetPath || "").trim();
  const root = String(rootUrl || "").trim();
  if (!source || !root) {
    return source;
  }
  if (isExternalSource(source) || isFileUrl(source) || isAbsoluteAssetPath(source)) {
    return source;
  }
  if (isFileUrl(root)) {
    return joinFileSystemRoot(fromFileSystemUrl(root), source);
  }
  if (isAbsoluteRootPath(root)) {
    return joinFileSystemRoot(root, source);
  }
  if (/^https?:/i.test(root)) {
    const base = root.endsWith("/") ? root : `${root}/`;
    return new URL(source, base).toString();
  }
  return source;
}


