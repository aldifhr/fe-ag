"use client";
import { useState, useEffect, useRef } from "react";

export default function IncidentBadge() {
  const [count, setCount] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    fetch("/api/reader/incidents")
      .then((r) => r.json())
      .then((body) => {
        if (body.success && body.data) {
          setCount(body.data.ongoingCount || 0);
        }
      })
      .catch((err) => console.warn("Failed to fetch incidents:", err));
  }, []);

  if (count === 0) return null;

  return (
    <span className="absolute -top-1.5 -right-2 flex items-center justify-center">
      <span className="w-2 h-2 bg-red-500 rounded-full" />
    </span>
  );
}
