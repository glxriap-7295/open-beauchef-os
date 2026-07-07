import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speech-to-Text con la Web Speech API del navegador (gratis, sin APIs pagas).
 * Español (es-CL). La arquitectura deja lugar para Text-to-Speech a futuro
 * (ver useTextToSpeech más abajo, usando speechSynthesis).
 */
function getRecognition() {
  if (typeof window === 'undefined') return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

export function useSpeechToText({ lang = 'es-CL', onResult } = {}) {
  const [soportado] = useState(() => Boolean(
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  ));
  const [escuchando, setEscuchando] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!soportado) return undefined;
    const rec = getRecognition();
    if (!rec) return undefined;
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let texto = '';
      for (let i = 0; i < e.results.length; i += 1) texto += e.results[i][0].transcript;
      setTranscript(texto);
      const final = e.results[e.results.length - 1]?.isFinal;
      if (final && onResultRef.current) onResultRef.current(texto.trim());
    };
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    recRef.current = rec;
    return () => { try { rec.abort(); } catch { /* noop */ } };
  }, [soportado, lang]);

  const start = useCallback(() => {
    if (!recRef.current || escuchando) return;
    setTranscript('');
    try { recRef.current.start(); setEscuchando(true); } catch { /* ya activo */ }
  }, [escuchando]);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.stop(); } catch { /* noop */ }
    setEscuchando(false);
  }, []);

  const toggle = useCallback(() => { if (escuchando) stop(); else start(); }, [escuchando, start, stop]);

  return { soportado, escuchando, transcript, start, stop, toggle };
}

/**
 * Text-to-Speech (preparado para el futuro). Usa speechSynthesis del navegador.
 * Hoy no se activa en la UI, pero deja lista la arquitectura de voz de salida.
 */
export function speak(texto, { lang = 'es-CL' } = {}) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lang;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
