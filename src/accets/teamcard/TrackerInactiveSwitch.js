import { useEffect, useId, useRef, useState } from "react";

const LONG_PRESS_MS = 550;
const TAP_MOVE_TOLERANCE = 10;

function TrackerInactiveSwitch({ checked, onToggle }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = useId();
  const controlRef = useRef(null);
  const timerRef = useRef(null);
  const touchStartRef = useRef(null);
  const longPressRef = useRef(false);
  const cancelledRef = useRef(false);
  const lastTouchEndRef = useRef(0);

  const clearLongPress = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!tooltipOpen) return undefined;
    const closeOnOutsidePress = (event) => {
      if (!controlRef.current?.contains(event.target)) setTooltipOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [tooltipOpen]);

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressRef.current = false;
    cancelledRef.current = false;
    clearLongPress();
    timerRef.current = window.setTimeout(() => {
      longPressRef.current = true;
      setTooltipOpen(false);
      onToggle();
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    const start = touchStartRef.current;
    if (start && (Math.abs(touch.clientX - start.x) > TAP_MOVE_TOLERANCE ||
      Math.abs(touch.clientY - start.y) > TAP_MOVE_TOLERANCE)) {
      cancelledRef.current = true;
      clearLongPress();
    }
  };

  const handleTouchEnd = (event) => {
    lastTouchEndRef.current = Date.now();
    clearLongPress();
    if (cancelledRef.current) return;
    event.preventDefault();
    if (longPressRef.current) return;
    if (tooltipOpen) {
      setTooltipOpen(false);
      onToggle();
    } else {
      setTooltipOpen(true);
    }
  };

  return (
    <div className="tracker-inactive-control" ref={controlRef}>
      <button
        type="button"
        className="tracker-inactive-switch"
        role="switch"
        aria-checked={checked}
        aria-label="Показать команды неактивных потоков"
        aria-describedby={tooltipId}
        onClick={(event) => {
          if (Date.now() - lastTouchEndRef.current < 750) {
            event.preventDefault();
            return;
          }
          setTooltipOpen(false);
          onToggle();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={clearLongPress}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "Escape") setTooltipOpen(false);
        }}
      >
        <span className="slider" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`tracker-inactive-tooltip${tooltipOpen ? " is-open" : ""}`}
      >
        Показать команды неактивных потоков
      </span>
    </div>
  );
}

export default TrackerInactiveSwitch;
