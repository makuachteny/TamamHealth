'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw } from '@/components/icons/lucide';

interface PhotoCaptureProps {
  value?: string; // base64 data URL
  onChange: (base64: string | undefined) => void;
  size?: number; // px, default 112 (w-28)
}

export default function PhotoCapture({ value, onChange, size = 112 }: PhotoCaptureProps) {
  const [mode, setMode] = useState<'idle' | 'camera'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setStream(mediaStream);
      setMode('camera');
      // Wait for ref to be available after re-render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 50);
    } catch (err) {
      console.error('Camera access denied:', err);
      // Fallback to file picker
      fileInputRef.current?.click();
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setMode('idle');
  }, [stream]);

  // Stop camera tracks on unmount: if the user navigates away (or the
  // parent unmounts the modal containing this component) while the live
  // viewfinder is active, the OS-level camera stays on until GC. Explicitly
  // stop the tracks so the privacy indicator clears immediately.
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const dim = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    // Center-crop to square
    const sx = (video.videoWidth - dim) / 2;
    const sy = (video.videoHeight - dim) / 2;
    ctx.drawImage(video, sx, sy, dim, dim, 0, 0, 400, 400);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    onChange(dataUrl);
    stopCamera();
  }, [onChange, stopCamera]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Resize to 400x400 square
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d')!;
        const dim = Math.min(img.width, img.height);
        const sx = (img.width - dim) / 2;
        const sy = (img.height - dim) / 2;
        ctx.drawImage(img, sx, sy, dim, dim, 0, 0, 400, 400);
        onChange(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // Reset the input so re-selecting the same file triggers onChange
    e.target.value = '';
  }, [onChange]);

  // Camera mode: show live viewfinder
  if (mode === 'camera') {
    return (
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ width: size, height: size, background: '#000' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 inset-x-0 flex justify-center gap-2 p-1.5" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <button
            type="button"
            onClick={capturePhoto}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--tamamhealth-blue)', color: '#fff' }}
            title="Take photo"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={stopCamera}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Has photo: show preview with controls
  if (value) {
    return (
      <div className="relative group" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Patient photo"
          className="w-full h-full object-cover rounded-lg"
        />
        <div className="absolute inset-0 rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <button
            type="button"
            onClick={startCamera}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            title="Retake photo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(229,46,66,0.8)', color: '#fff' }}
            title="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  // Idle: show placeholder with actions
  return (
    <div style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-[var(--tamamhealth-blue)] transition-colors"
        style={{ borderColor: 'var(--border-medium)', background: 'var(--overlay-subtle)' }}
        onClick={startCamera}
      >
        <Camera className="w-6 h-6 mb-1" style={{ color: 'var(--text-muted)' }} />
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Take Photo</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="mt-1 text-[9px] underline"
          style={{ color: 'var(--tamamhealth-blue)' }}
        >
          or upload
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
