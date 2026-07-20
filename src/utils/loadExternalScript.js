const scriptPromises = new Map();

export default function loadExternalScript(src) {
  if (!src) {
    return Promise.reject(new Error("Script source is required."));
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Scripts can only be loaded in the browser."));
  }

  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript?.dataset?.loaded === "true") {
    return Promise.resolve(true);
  }

  if (scriptPromises.has(src)) {
    return scriptPromises.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const script = existingScript || document.createElement("script");

    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    const handleLoad = () => {
      script.dataset.loaded = "true";
      cleanup();
      resolve(true);
    };

    const handleError = () => {
      cleanup();
      scriptPromises.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!existingScript) {
      script.src = src;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  });

  scriptPromises.set(src, promise);
  return promise;
}
