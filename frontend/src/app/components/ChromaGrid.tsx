import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";

export interface ChromaItem {
  image: string;
  title: string;
  subtitle: string;
  handle?: string;
  location?: string;
  borderColor?: string;
  gradient?: string;
  url?: string;
}

export interface ChromaGridProps {
  items?: ChromaItem[];
  className?: string;
  radius?: number;
  damping?: number;
  ease?: string;
  imageClassName?: string;
  imageSize?: string;
  imageBorderRadius?: string;
}

type SetterFn = (v: number | string) => void;

const ChromaGrid: React.FC<ChromaGridProps> = ({
  items,
  className = "",
  radius = 300,
  damping = 0.45,
  ease = "power3.out",
  imageClassName = "",
  imageSize = "w-full h-full",
  imageBorderRadius = "rounded-[10px]",
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const setX = useRef<SetterFn | null>(null);
  const setY = useRef<SetterFn | null>(null);
  const pos = useRef({ x: 0, y: 0 });

  const data = items?.length ? items : [];

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setX.current = gsap.quickSetter(el, "--x", "px") as SetterFn;
    setY.current = gsap.quickSetter(el, "--y", "px") as SetterFn;
    const { width, height } = el.getBoundingClientRect();
    pos.current = { x: width / 2, y: height / 2 };
    setX.current(pos.current.x);
    setY.current(pos.current.y);
  }, []);

  const moveTo = (x: number, y: number) => {
    gsap.to(pos.current, {
      x,
      y,
      duration: damping,
      ease,
      onUpdate: () => {
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
      },
      overwrite: true,
    });
  };

  const handleMove = (e: React.PointerEvent) => {
    const r = rootRef.current!.getBoundingClientRect();
    moveTo(e.clientX - r.left, e.clientY - r.top);
  };

  const handleCardClick = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCardMove: React.MouseEventHandler<HTMLElement> = (e) => {
    const c = e.currentTarget as HTMLElement;
    const rect = c.getBoundingClientRect();
    c.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    c.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={rootRef}
      onPointerMove={handleMove}
      className={`relative w-full h-full flex flex-wrap justify-center items-start gap-8 ${className}`}
      style={
        {
          "--r": `${radius}px`,
          "--x": "50%",
          "--y": "50%",
        } as React.CSSProperties
      }
    >
      {data.map((c, i) => {
        // Filigrane uniforme pour chaque carte
        const getOverlayEffect = {
          backdropFilter: "grayscale(1) brightness(0.78)",
          WebkitBackdropFilter: "grayscale(1) brightness(0.78)",
          background: "rgba(0,0,0,0.001)"
        };

        return (
          <article
            key={i}
            onMouseMove={handleCardMove}
            onClick={() => handleCardClick(c.url)}
            className="group relative flex flex-col w-full sm:w-[300px] rounded-3xl overflow-hidden transition-colors duration-300 cursor-pointer"
            style={
              {
                "--card-border": c.borderColor || "transparent",
                background: c.gradient,
                "--spotlight-color": "rgba(255,255,255,0.3)",
              } as React.CSSProperties
            }
          >
            {/* Effet de survol (spotlight) */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-20 opacity-0 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle at var(--mouse-x) var(--mouse-y), var(--spotlight-color), transparent 70%)",
              }}
            />
            
            {/* Filigrane individuel pour chaque carte */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-15 opacity-0 md:opacity-100 md:group-hover:opacity-0"
              style={getOverlayEffect}
            />

            <div className="relative z-10 flex-1 p-[10px] box-border flex items-center justify-center">
              <img
                src={c.image}
                alt={c.title}
                loading="lazy"
                className={`${imageSize} object-cover ${imageBorderRadius} ${imageClassName}`}
              />
            </div>
            <footer className="relative z-10 p-7 text-white font-sans h-[140px] flex flex-col">
              <div className="flex justify-between items-start mb-1">
                <h3 className="m-0 text-[1.05rem] font-semibold">{c.title}</h3>
                {c.handle && (
                  <span className="text-[0.95rem] opacity-80">
                    {c.handle}
                  </span>
                )}
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex justify-between items-center w-full">
                  <p className="m-0 text-[0.85rem] text-gray-500 leading-tight">{c.subtitle}</p>
                  {c.location && (
                    <span className="text-[0.85rem] opacity-85">
                      {c.location}
                    </span>
                  )}
                </div>
              </div>
            </footer>
          </article>
        );
      })}

    </div>
  );
};

export default ChromaGrid; 