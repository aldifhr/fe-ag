"use client";
import { useRef, useState, useCallback } from "react";

interface UseZoomPanOptions {
  onZoomChange?: (zoom: number, idx: number | null) => void;
}

export function useZoomPan(opts?: UseZoomPanOptions) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [zoomedImageIdx, setZoomedImageIdx] = useState<number | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const zoomLevelRef = useRef(1);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchActiveRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent, idx: number) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      pinchStartRef.current = { dist, zoom: zoomLevelRef.current };
      pinchActiveRef.current = true;
      return;
    }

    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap
        e.preventDefault();
        const newZoom = zoomLevelRef.current > 1 ? 1 : 2;
        zoomLevelRef.current = newZoom;
        setZoomLevel(newZoom);
        if (newZoom > 1) {
          setZoomedImageIdx(idx);
          const touch = e.touches[0];
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = ((touch.clientX - rect.left) / rect.width) * 100;
          const y = ((touch.clientY - rect.top) / rect.height) * 100;
          setZoomOrigin({ x, y });
          setPanOffset({ x: 0, y: 0 });
          panOffsetRef.current = { x: 0, y: 0 };
        } else {
          setZoomedImageIdx(null);
          setPanOffset({ x: 0, y: 0 });
          panOffsetRef.current = { x: 0, y: 0 };
        }
        lastTapRef.current = 0;
        opts?.onZoomChange?.(newZoom, newZoom > 1 ? idx : null);
        return;
      }
      lastTapRef.current = now;

      if (zoomLevelRef.current > 1) {
        const touch = e.touches[0];
        panStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          ox: panOffsetRef.current.x,
          oy: panOffsetRef.current.y,
        };
      }
    }
  }, [opts]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchStartRef.current.dist;
      const newZoom = Math.max(1, Math.min(5, pinchStartRef.current.zoom * scale));
      zoomLevelRef.current = newZoom;
      setZoomLevel(newZoom);
      if (newZoom <= 1) {
        setZoomedImageIdx(null);
        setPanOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
      }
      return;
    }

    if (e.touches.length === 1 && zoomLevelRef.current > 1 && panStartRef.current && !pinchActiveRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - panStartRef.current.x;
      const dy = touch.clientY - panStartRef.current.y;
      const newOffset = {
        x: panStartRef.current.ox + dx,
        y: panStartRef.current.oy + dy,
      };
      panOffsetRef.current = newOffset;
      setPanOffset(newOffset);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pinchActiveRef.current) {
      pinchActiveRef.current = false;
      pinchStartRef.current = null;
      if (zoomLevelRef.current <= 1) {
        setZoomedImageIdx(null);
        setPanOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
      }
    }
    panStartRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(1, Math.min(5, zoomLevelRef.current + delta));
    zoomLevelRef.current = newZoom;
    setZoomLevel(newZoom);
    if (newZoom <= 1) {
      setZoomedImageIdx(null);
      setPanOffset({ x: 0, y: 0 });
      panOffsetRef.current = { x: 0, y: 0 };
    }
  }, []);

  const resetZoom = useCallback(() => {
    zoomLevelRef.current = 1;
    setZoomLevel(1);
    setZoomedImageIdx(null);
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
  }, []);

  return {
    zoomLevel,
    zoomOrigin,
    zoomedImageIdx,
    panOffset,
    pinchActiveRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
    resetZoom,
  };
}
