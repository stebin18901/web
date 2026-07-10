import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useSearchParams } from "react-router-dom";

import { db } from "../firebase/firebaseConfig";
import { getAppReleaseConfig } from "../utils/appReleaseConfig";

const shellStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background:
    "radial-gradient(circle at top, #fff7ed 0%, #eff6ff 45%, #dbeafe 100%)",
};

const cardStyle = {
  width: "100%",
  maxWidth: "560px",
  borderRadius: "30px",
  padding: "40px 32px",
  background: "#ffffff",
  boxShadow: "0 28px 80px rgba(15, 23, 42, 0.14)",
  fontFamily: "system-ui, sans-serif",
};

export default function Downloads() {
  const [searchParams] = useSearchParams();
  const appRelease = useMemo(
    () => getAppReleaseConfig(searchParams.get("app") || "student"),
    [searchParams]
  );
  const [state, setState] = useState({
    loading: true,
    error: "",
    downloadUrl: "",
  });

  useEffect(() => {
    let active = true;

    async function loadDownloadTarget() {
      try {
        const snapshot = await getDoc(doc(db, "app_metadata", appRelease.configDocId));
        const data = snapshot.data();

        if (!active) {
          return;
        }

        if (data?.download_url) {
          setState({
            loading: false,
            error: "",
            downloadUrl: data.download_url,
          });

          window.location.replace(data.download_url);
          return;
        }

        setState({
          loading: false,
          error: `The ${appRelease.label.toLowerCase()} APK is not configured yet.`,
          downloadUrl: "",
        });
      } catch (error) {
        setState({
          loading: false,
          error: `We could not fetch the latest ${appRelease.label.toLowerCase()} APK right now.`,
          downloadUrl: "",
        });
      }
    }

    loadDownloadTarget();

    return () => {
      active = false;
    };
  }, [appRelease]);

  return (
    <main style={shellStyle}>
      <section style={cardStyle}>
        <p
          style={{
            margin: 0,
            color: "#c2410c",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {appRelease.shortLabel} Android APK
        </p>
        <h1
          style={{
            margin: "14px 0 12px",
            color: "#0f172a",
            fontSize: "clamp(2rem, 5vw, 3rem)",
            lineHeight: 1.02,
          }}
        >
          Download the latest {appRelease.label.toLowerCase()} build
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, fontSize: "1rem" }}>
          {state.loading
            ? "Preparing your download..."
            : state.error || "If the download did not begin automatically, use the button below."}
        </p>

        {state.downloadUrl ? (
          <a
            href={state.downloadUrl}
            style={{
              display: "inline-flex",
              marginTop: "24px",
              padding: "15px 22px",
              borderRadius: "16px",
              background: "#0f766e",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Download APK
          </a>
        ) : null}
      </section>
    </main>
  );
}
