import { useCallback, useEffect, useRef, useState } from "react";

export type FacingMode = "user" | "environment";

/**
 * Manages the webcam stream lifecycle with full iOS Safari,
 * Android Chrome, and laptop webcam resilience and fallbacks.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(
    async (targetFacingMode: FacingMode = facingMode) => {
      setError(null);
      stop();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(
          "Camera API is not supported on this browser or connection is not HTTPS/localhost.",
        );
        setActive(false);
        return;
      }

      let stream: MediaStream | null = null;

      // 1. First Attempt: Ideal HD Resolution with specified facing mode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacingMode },
            width: { ideal: 1280, min: 320 },
            height: { ideal: 720, min: 240 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn("Primary camera constraint failed, attempting fallback:", err1);

        // 2. Second Attempt: Basic facing mode constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacingMode },
            audio: false,
          });
        } catch (err2) {
          console.warn("Facing mode constraint failed, attempting universal fallback:", err2);

          // 3. Third Attempt: Generic video stream (any available webcam)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (err3: unknown) {
            const errObj = err3 as Error | undefined;
            console.error("All camera constraints failed:", err3);
            if (errObj?.name === "NotAllowedError" || errObj?.name === "PermissionDeniedError") {
              setError(
                "Camera permission denied. Please allow camera access in your browser settings.",
              );
            } else if (
              errObj?.name === "NotFoundError" ||
              errObj?.name === "DevicesNotFoundError"
            ) {
              setError("No camera hardware detected on this device.");
            } else if (errObj?.name === "NotReadableError" || errObj?.name === "TrackStartError") {
              setError("Camera is currently in use by another application or tab.");
            } else {
              setError("Could not access camera: " + (errObj?.message || "Unknown error"));
            }
            setActive(false);
            return;
          }
        }
      }

      if (!stream) {
        setError("Failed to acquire video stream.");
        setActive(false);
        return;
      }

      streamRef.current = stream;
      setFacingMode(targetFacingMode);

      const video = videoRef.current;
      if (video) {
        // Critical iOS Safari and mobile browser attributes
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.setAttribute("muted", "true");
        video.setAttribute("autoplay", "true");
        video.muted = true;
        video.srcObject = stream;

        // Ensure video is playing and ready before setting active
        try {
          await video.play();
        } catch (playErr) {
          console.warn("Autoplay promise failed, waiting for user interaction:", playErr);
        }

        // Wait for metadata / dimensions to be populated
        if (video.readyState < 2) {
          await new Promise<void>((resolve) => {
            const onLoaded = () => {
              video.removeEventListener("loadeddata", onLoaded);
              resolve();
            };
            video.addEventListener("loadeddata", onLoaded);
            // Timeout fallback
            setTimeout(resolve, 1000);
          });
        }

        setActive(true);
      } else {
        setActive(true);
      }
    },
    [facingMode, stop],
  );

  const flipCamera = useCallback(async () => {
    const nextMode: FacingMode = facingMode === "user" ? "environment" : "user";
    await start(nextMode);
  }, [facingMode, start]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { videoRef, start, stop, active, error, facingMode, flipCamera };
}
