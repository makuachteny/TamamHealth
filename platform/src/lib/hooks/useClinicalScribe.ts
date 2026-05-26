'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ScribeExtraction } from '../services/clinical-scribe-service';

export type ScribeStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'done';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export interface UseClinicalScribeReturn {
  status: ScribeStatus;
  transcript: string;
  interimText: string;
  extraction: ScribeExtraction | null;
  soapNote: string;
  isSupported: boolean;
  error: string | null;
  duration: number;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  processTranscript: (text?: string) => void;
  setManualTranscript: (text: string) => void;
  reset: () => void;
}

export function useClinicalScribe(): UseClinicalScribeReturn {
  const [status, setStatus] = useState<ScribeStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [extraction, setExtraction] = useState<ScribeExtraction | null>(null);
  const [soapNote, setSoapNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);
  const statusRef = useRef<ScribeStatus>(status);
  statusRef.current = status;

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(accumulatedTimeRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    accumulatedTimeRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    setError(null);

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setStatus('recording');
        startTimer();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
        }
        setInterimText(interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech') return; // ignore silence
        if (event.error === 'aborted') return; // user stopped
        setError(`Speech recognition error: ${event.error}`);
        setStatus('idle');
        stopTimer();
      };

      recognition.onend = () => {
        // Auto-restart if still recording (browser may stop after silence)
        // Use ref to avoid stale closure over status
        if (statusRef.current === 'recording') {
          try {
            recognition.start();
          } catch {
            // Already started or permission denied
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      setError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isSupported, startTimer, stopTimer]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      setStatus('idle');
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setInterimText('');
    stopTimer();
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (recognitionRef.current) {
      setStatus('paused');
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setInterimText('');
    stopTimer();
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    startRecording();
  }, [startRecording]);

  const processTranscript = useCallback(async (overrideText?: string) => {
    const textToProcess = overrideText || transcript;
    if (!textToProcess.trim()) return;

    setStatus('processing');
    try {
      // Dynamic import to keep it browser-only
      const { extractClinicalData, generateSOAPNote } = await import('../services/clinical-scribe-service');
      const result = extractClinicalData(textToProcess);
      setExtraction(result);
      setSoapNote(generateSOAPNote(result));
      setStatus('done');
    } catch (err) {
      setError(`Processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStatus('idle');
    }
  }, [transcript]);

  const setManualTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  const reset = useCallback(() => {
    stopRecording();
    setTranscript('');
    setInterimText('');
    setExtraction(null);
    setSoapNote('');
    setError(null);
    setDuration(0);
    accumulatedTimeRef.current = 0;
    setStatus('idle');
  }, [stopRecording]);

  return {
    status,
    transcript,
    interimText,
    extraction,
    soapNote,
    isSupported,
    error,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    processTranscript,
    setManualTranscript,
    reset,
  };
}
