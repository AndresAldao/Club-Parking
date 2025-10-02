import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function QRScanner({ onScan, onError, fps = 10, qrbox = 250 }) {
  const ref = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (scannerRef.current) return; // evitar doble init

    const config = {
      fps,
      qrbox,
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
    };

    const scanner = new Html5QrcodeScanner(ref.current.id, config, false);
    scanner.render(
      (decodedText) => {
        onScan?.(decodedText);
      },
      (errMsg) => {
        onError?.(errMsg);
      }
    );
    scannerRef.current = scanner;

    return () => {
      // cleanup con promesa
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {
          // silenciamos errores de limpieza (ej: cámara ya cerrada)
        });
        scannerRef.current = null;
      }
    };
  }, [onScan, onError, fps, qrbox]);

  return (
    <div>
      <div id="qr-reader" ref={ref} className="rounded overflow-hidden border"></div>
    </div>
  );
}
