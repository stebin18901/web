export const APP_RELEASES = {
  student: {
    key: "student",
    label: "Student App",
    shortLabel: "Student",
    configDocId: "android_config",
    storagePath: "apk/app.apk",
    downloadRoute: "/downloads?app=student",
    audienceLabel: "student Android app",
    description:
      "Publish the Android build used by students for dashboard, quiz, and league access.",
  },
  parent: {
    key: "parent",
    label: "Parent App",
    shortLabel: "Parent",
    configDocId: "android_config_parent",
    storagePath: "apk/parent-app.apk",
    downloadRoute: "/downloads?app=parent",
    audienceLabel: "parent Android app",
    description:
      "Publish the Android build used by parents for attendance, marks, and school alerts.",
  },
};

export const DEFAULT_APP_RELEASE_KEY = "student";

export function getAppReleaseConfig(appKey) {
  return APP_RELEASES[appKey] || APP_RELEASES[DEFAULT_APP_RELEASE_KEY];
}

export function normalizeVersionToken(version) {
  return String(version || "")
    .trim()
    .replace(/[^0-9.]/g, "");
}

export function compareReleaseVersions(left, right) {
  const leftParts = normalizeVersionToken(left)
    .split(".")
    .filter(Boolean)
    .map((part) => Number(part));
  const rightParts = normalizeVersionToken(right)
    .split(".")
    .filter(Boolean)
    .map((part) => Number(part));

  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export function getAppReleaseStorageKey(appKey) {
  return `hepsyAppReleaseVersion:${getAppReleaseConfig(appKey).key}`;
}
