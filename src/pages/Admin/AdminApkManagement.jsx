import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { db, storage } from "../../firebase/firebaseConfig";
import { getAppReleaseConfig } from "../../utils/appReleaseConfig";
import "./AdminApkManagement.css";

export default function AdminApkManagement({ appKey = "student" }) {
  const appRelease = getAppReleaseConfig(appKey);
  const [apkFile, setApkFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [minVersion, setMinVersion] = useState("");
  const [isForceUpdate, setIsForceUpdate] = useState(true);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [status, setStatus] = useState({
    loading: false,
    error: "",
    success: "",
    progress: 0,
    phase: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const snapshot = await getDoc(doc(db, "app_metadata", appRelease.configDocId));

        if (!active || !snapshot.exists()) {
          return;
        }

        const data = snapshot.data();
        setCurrentConfig(data);
        setMinVersion(data?.min_version || "");
        setIsForceUpdate(Boolean(data?.is_force_update));
      } catch (error) {
        console.error(`Failed to fetch ${appRelease.key} APK config`, error);
      }
    }

    loadConfig();

    return () => {
      active = false;
    };
  }, [appRelease.configDocId, appRelease.key]);

  function setSelectedFile(file) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".apk")) {
      setStatus({
        loading: false,
        error: "Only .apk files are allowed here.",
        success: "",
        progress: 0,
        phase: "",
      });
      return;
    }

    setApkFile(file);
    setStatus({
      loading: false,
      error: "",
      success: "",
      progress: 0,
      phase: "",
    });
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    setSelectedFile(event.dataTransfer.files?.[0]);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragging(false);
  }

  function handleFileChange(event) {
    setSelectedFile(event.target.files?.[0]);
  }

  async function handlePublish() {
    if (!apkFile) {
      setStatus({
        loading: false,
        error: "Select the new APK before publishing.",
        success: "",
        progress: 0,
        phase: "",
      });
      return;
    }

    if (!minVersion.trim()) {
      setStatus({
        loading: false,
        error: "Enter the minimum supported version, for example 1.1.0.",
        success: "",
        progress: 0,
        phase: "",
      });
      return;
    }

    setStatus({
      loading: true,
      error: "",
      success: "",
      progress: 0,
      phase: "Uploading APK to Firebase Storage...",
    });

    try {
      const storageRef = ref(storage, appRelease.storagePath);
      const uploadTask = uploadBytesResumable(storageRef, apkFile, {
        contentType: "application/vnd.android.package-archive",
      });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = snapshot.totalBytes
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0;

            setStatus((prev) => ({
              ...prev,
              loading: true,
              progress,
              phase:
                progress >= 100
                  ? "Finalizing APK upload..."
                  : `Uploading APK to Firebase Storage... ${progress}%`,
            }));
          },
          reject,
          resolve
        );
      });

      setStatus((prev) => ({
        ...prev,
        loading: true,
        progress: 100,
        phase: "Refreshing live release policy...",
      }));
      const binaryUrl = await getDownloadURL(storageRef);
      const nextConfig = {
        latest_version: minVersion.trim(),
        min_version: minVersion.trim(),
        download_url: binaryUrl,
        is_force_update: isForceUpdate,
        updated_at: serverTimestamp(),
      };

      await setDoc(doc(db, "app_metadata", appRelease.configDocId), nextConfig, {
        merge: true,
      });

      setCurrentConfig({
        ...currentConfig,
        ...nextConfig,
        updated_at: "Just now",
      });
      setStatus({
        loading: false,
        error: "",
        success: `${appRelease.label} APK published successfully. New installs and update prompts will now use this build.`,
        progress: 100,
        phase: "Publish complete.",
      });
    } catch (error) {
      console.error(`${appRelease.key} APK publish failed`, error);
      setStatus({
        loading: false,
        error: error?.message || "Publishing failed. Please try again.",
        success: "",
        progress: 0,
        phase: "",
      });
    }
  }

  const fileSizeLabel = apkFile
    ? `${(apkFile.size / (1024 * 1024)).toFixed(1)} MB`
    : "";

  return (
    <div className="apk-admin-shell">
      <section className="apk-admin-hero">
        <p className="apk-admin-kicker">Release Control</p>
        <h3>{appRelease.label} APK Management</h3>
        <p>
          {appRelease.description} Upload the production Android package, set
          the minimum supported version, and decide whether older app versions
          must hard-update before they can continue.
        </p>
      </section>

      <div className="apk-admin-grid">
        <section className="apk-admin-card">
          <h4>Publish a new {appRelease.shortLabel.toLowerCase()} Android build</h4>
          <p>
            The uploaded file will overwrite <code>/{appRelease.storagePath}</code>{" "}
            in Firebase Storage and then refresh the live release policy in
            Firestore for the {appRelease.audienceLabel}.
          </p>

          <div
            className={`apk-dropzone ${dragging ? "dragging" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <strong>Drag and drop your APK here</strong>
            <span>
              {apkFile
                ? `Selected file: ${apkFile.name}`
                : "Drop a .apk file here or use the button below to browse."}
            </span>
            {apkFile ? <small className="apk-file-meta">File size: {fileSizeLabel}</small> : null}

            <button
              type="button"
              className="apk-hidden-input-trigger"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose APK File
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={handleFileChange}
            />
          </div>

          <div className="apk-form-grid">
            <div className="apk-field">
              <label htmlFor="apk-min-version">Minimum version</label>
              <input
                id="apk-min-version"
                type="text"
                value={minVersion}
                onChange={(event) => setMinVersion(event.target.value)}
                placeholder="1.1.0"
              />
            </div>

            <div className="apk-toggle">
              <div>
                <div className="apk-toggle-label">Enforce Hard Update Validation</div>
                <p>
                  When enabled, {appRelease.audienceLabel} builds below the
                  minimum version will be blocked until users update from the
                  download page.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isForceUpdate}
                onChange={(event) => setIsForceUpdate(event.target.checked)}
              />
            </div>

            <button
              type="button"
              className="apk-publish"
              onClick={handlePublish}
              disabled={status.loading}
            >
              {status.loading ? "Publishing update..." : "Publish Update"}
            </button>
          </div>

          {status.loading ? (
            <div className="apk-progress-card" aria-live="polite">
              <div className="apk-progress-head">
                <strong>{status.phase || "Uploading..."}</strong>
                <span>{status.progress}%</span>
              </div>
              <div className="apk-progress-track">
                <div
                  className="apk-progress-fill"
                  style={{ width: `${Math.max(4, status.progress)}%` }}
                />
              </div>
              <p>
                Large APK uploads can take a little while. The browser console
                preload warning is unrelated to this upload.
              </p>
            </div>
          ) : null}

          {status.error ? <div className="apk-status error">{status.error}</div> : null}
          {status.success ? <div className="apk-status success">{status.success}</div> : null}
        </section>

        <aside className="apk-admin-card">
          <h4>Current live policy</h4>
          <p>
            This reflects the last known release metadata stored in Firestore
            for the {appRelease.audienceLabel}.
          </p>

          <div className="apk-meta-list">
            <div className="apk-meta-item">
              <strong>Live release version</strong>
              <span>{currentConfig?.latest_version || currentConfig?.min_version || "Not set yet"}</span>
            </div>
            <div className="apk-meta-item">
              <strong>Minimum version</strong>
              <span>{currentConfig?.min_version || "Not set yet"}</span>
            </div>
            <div className="apk-meta-item">
              <strong>Force update</strong>
              <span>{currentConfig?.is_force_update ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="apk-meta-item">
              <strong>Download URL</strong>
              <span>{currentConfig?.download_url || "Not published yet"}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
