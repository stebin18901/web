import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "../../firebase/firebaseConfig";
import "./AdminApkManagement.css";

const APK_STORAGE_PATH = "apk/app.apk";

export default function AdminApkManagement() {
  const [apkFile, setApkFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [minVersion, setMinVersion] = useState("");
  const [isForceUpdate, setIsForceUpdate] = useState(true);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [status, setStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const snapshot = await getDoc(doc(db, "app_metadata", "android_config"));

        if (!active || !snapshot.exists()) {
          return;
        }

        const data = snapshot.data();
        setCurrentConfig(data);
        setMinVersion(data?.min_version || "");
        setIsForceUpdate(Boolean(data?.is_force_update));
      } catch (error) {
        console.error("Failed to fetch APK config", error);
      }
    }

    loadConfig();

    return () => {
      active = false;
    };
  }, []);

  function setSelectedFile(file) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".apk")) {
      setStatus({
        loading: false,
        error: "Only .apk files are allowed here.",
        success: "",
      });
      return;
    }

    setApkFile(file);
    setStatus({
      loading: false,
      error: "",
      success: "",
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
      });
      return;
    }

    if (!minVersion.trim()) {
      setStatus({
        loading: false,
        error: "Enter the minimum supported version, for example 1.1.0.",
        success: "",
      });
      return;
    }

    setStatus({
      loading: true,
      error: "",
      success: "",
    });

    try {
      const storageRef = ref(storage, APK_STORAGE_PATH);

      await uploadBytes(storageRef, apkFile, {
        contentType: "application/vnd.android.package-archive",
      });

      const binaryUrl = await getDownloadURL(storageRef);
      const nextConfig = {
        min_version: minVersion.trim(),
        download_url: binaryUrl,
        is_force_update: isForceUpdate,
        updated_at: serverTimestamp(),
      };

      await setDoc(doc(db, "app_metadata", "android_config"), nextConfig, {
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
        success: "APK published successfully. New devices and forced updates will now use this build.",
      });
    } catch (error) {
      console.error("APK publish failed", error);
      setStatus({
        loading: false,
        error: error?.message || "Publishing failed. Please try again.",
        success: "",
      });
    }
  }

  return (
    <div className="apk-admin-shell">
      <section className="apk-admin-hero">
        <p className="apk-admin-kicker">Release Control</p>
        <h3>APK Management</h3>
        <p>
          Upload the production Android package, set the minimum supported
          version, and decide whether older app versions must hard-update before
          they can continue.
        </p>
      </section>

      <div className="apk-admin-grid">
        <section className="apk-admin-card">
          <h4>Publish a new Android build</h4>
          <p>
            The uploaded file will overwrite <code>/apk/app.apk</code> in
            Firebase Storage and then refresh the global version policy in
            Firestore.
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
                  When enabled, mobile app builds below the minimum version will
                  be blocked until users update from the download page.
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

          {status.error ? <div className="apk-status error">{status.error}</div> : null}
          {status.success ? <div className="apk-status success">{status.success}</div> : null}
        </section>

        <aside className="apk-admin-card">
          <h4>Current live policy</h4>
          <p>
            This reflects the last known release metadata stored in Firestore.
          </p>

          <div className="apk-meta-list">
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
