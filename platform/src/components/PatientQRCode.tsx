'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Printer } from '@/components/icons/lucide';

interface PatientQRCodeProps {
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  size?: number;
}

export default function PatientQRCode({ patientId, patientName, hospitalNumber, size = 160 }: PatientQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      const QRCode = (await import('qrcode')).default;
      if (cancelled || !canvasRef.current) return;

      // Encode patient lookup data as JSON in the QR code
      const payload = JSON.stringify({
        type: 'TamamHealth_PATIENT',
        id: patientId,
        hn: hospitalNumber,
      });

      await QRCode.toCanvas(canvasRef.current, payload, {
        width: size,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      setReady(true);
    }
    generate();
    return () => { cancelled = true; };
  }, [patientId, hospitalNumber, size]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    // Create a new canvas with patient info label
    const labelCanvas = document.createElement('canvas');
    const padding = 20;
    const labelHeight = 50;
    labelCanvas.width = size + padding * 2;
    labelCanvas.height = size + padding * 2 + labelHeight;
    const ctx = labelCanvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

    // Draw QR code
    ctx.drawImage(canvasRef.current, padding, padding);

    // Draw label text
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(patientName, labelCanvas.width / 2, size + padding + 20);
    ctx.font = '11px monospace';
    ctx.fillText(hospitalNumber, labelCanvas.width / 2, size + padding + 38);

    const link = document.createElement('a');
    link.download = `QR-${hospitalNumber}-${patientName.replace(/\s+/g, '_')}.png`;
    link.href = labelCanvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    if (!printWindow) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    printWindow.document.write(`
      <html>
        <head><title>Patient QR - ${hospitalNumber}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;">
          <img src="${dataUrl}" width="${size}" height="${size}" />
          <p style="font-weight:bold;margin:12px 0 4px;">${patientName}</p>
          <p style="font-family:monospace;color:#666;margin:0;">${hospitalNumber}</p>
          <script>window.onload=()=>{window.print();window.close();}<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid var(--border-light)' }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
      {ready && (
        <>
          <p className="text-[11px] font-mono text-center" style={{ color: 'var(--text-muted)' }}>
            Scan to retrieve patient records
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors"
              style={{ background: 'var(--overlay-subtle)', color: 'var(--tamamhealth-blue)', border: '1px solid var(--border-light)' }}
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors"
              style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </>
      )}
    </div>
  );
}
