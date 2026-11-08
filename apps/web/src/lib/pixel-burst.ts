/**
 * The "copied" flourish: a few square pixels (like the logo's) burst from an element and fade.
 * Black and white (currentColor), half a second, nothing with reduced motion.
 */
export function pixelBurst(from: Element, count = 10) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = from.getBoundingClientRect();
  const color = getComputedStyle(document.body).color;
  for (let i = 0; i < count; i++) {
    const pixel = document.createElement("span");
    const size = 3 + Math.round(Math.random() * 3);
    Object.assign(pixel.style, {
      position: "fixed",
      left: `${box.left + box.width / 2}px`,
      top: `${box.top + box.height / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: color,
      pointerEvents: "none",
      zIndex: "100",
    });
    document.body.appendChild(pixel);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const distance = 18 + Math.random() * 22;
    pixel
      .animate(
        [
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0.4)`, opacity: 0 },
        ],
        { duration: 450 + Math.random() * 150, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      )
      .finished.finally(() => pixel.remove());
  }
}
