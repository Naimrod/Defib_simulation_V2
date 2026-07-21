import React, { useRef, useState, useEffect } from 'react';
import { useAudio } from '../../context/AudioContext';
import { calculateAngleFromCenter, findClosestSnapAngle, triggerHaptic } from '../../utils/rotaryUtils';

interface RotativeKnobProps {
  onValueChange?: (value: number) => void;
  initialValue?: number;
}

type PredefinedAngle = {
  value: string;
  angle: number;
};

// Predefined angles for the snap points
const predefinedAngles: PredefinedAngle[] = [
  { value: "DAE", angle: -35 },
  { value: "ARRET", angle: 0 },
  { value: "Moniteur", angle: 35 },
  { value: "1-10", angle: 60 },
  { value: "15", angle: 75 },
  { value: "20", angle: 90 },
  { value: "30", angle: 105 },
  { value: "50", angle: 120 },
  { value: "70", angle: 135 },
  { value: "100", angle: 150 },
  { value: "120", angle: 165 },
  { value: "150", angle: 180 },
  { value: "170", angle: 195 },
  { value: "200", angle: 210 },
  { value: "Stimu\nlateur", angle: 240 },
];

const snapAnglesList = predefinedAngles.map((p) => p.angle);

const RotativeKnob: React.FC<RotativeKnobProps> = ({
  onValueChange,
  initialValue = 0,
}) => {
  const [rotaryValue, setRotaryValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const rotaryRef = useRef<HTMLDivElement>(null);
  const audioService = useAudio();

  const initialKnobAngleRef = useRef(0);
  const initialMouseAngleRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    setRotaryValue(initialValue);
  }, [initialValue]);

  // Handles the start of a drag interaction using Pointer events
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!rotaryRef.current || activePointerIdRef.current !== null) return;

    activePointerIdRef.current = e.pointerId;
    setIsDragging(true);
    initialKnobAngleRef.current = rotaryValue;
    initialMouseAngleRef.current = calculateAngleFromCenter(rotaryRef.current, e.clientX, e.clientY);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Handles movement during drag
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !rotaryRef.current) return;
    if (activePointerIdRef.current !== e.pointerId) return;

    e.preventDefault();
    const currentMouseAngle = calculateAngleFromCenter(rotaryRef.current, e.clientX, e.clientY);
    let angleDelta = currentMouseAngle - initialMouseAngleRef.current;

    // Handle angle wrapping around 360 degrees
    if (angleDelta > 180) angleDelta -= 360;
    if (angleDelta < -180) angleDelta += 360;

    const newAngle = initialKnobAngleRef.current + angleDelta;
    const closestSnapAngle = findClosestSnapAngle(newAngle, snapAnglesList);

    // Prevent wrap-around between first and last predefined items
    const firstAngle = predefinedAngles[0].angle;
    const lastAngle = predefinedAngles[predefinedAngles.length - 1].angle;
    const isWrappingForward = rotaryValue === lastAngle && closestSnapAngle === firstAngle;
    const isWrappingBackward = rotaryValue === firstAngle && closestSnapAngle === lastAngle;

    if (isWrappingForward || isWrappingBackward) return;

    if (closestSnapAngle !== rotaryValue) {
      triggerHaptic(1);
      audioService.playClickSound("normal");
      setRotaryValue(closestSnapAngle);
      onValueChange?.(closestSnapAngle);
    }
  };

  // Handles release
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    activePointerIdRef.current = null;
    setIsDragging(false);
  };

  return (
    <div className="relative mt-6 -ml-5">
      <div className="absolute inset-0 w-56 h-56">
        {predefinedAngles.map((item) => (
          <div
            key={item.value}
            className="absolute text-white font-bold"
            style={{
              transform: `rotate(${item.angle - 90}deg) translate(86px) rotate(${-(item.angle - 90)}deg)`,
              transformOrigin: "50% 50%",
              left: "50%",
              top: "50%",
              marginLeft: item.value === "Moniteur" ? "-20px" : "-10px",
              marginTop: "-10px",
              fontSize: "10px",
              whiteSpace: "pre-line",
              textAlign: "center",
            }}
          >
            {item.value}
          </div>
        ))}
      </div>

      <div className="absolute inset-1 bg-green-500 opacity-20 rounded-full"></div>

      <div
        ref={rotaryRef}
        className="relative w-56 h-56 rounded-full border-gray-600 cursor-grab active:cursor-grabbing touch-manipulation select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `rotate(${rotaryValue}deg)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
          touchAction: "none",
        }}
      >
        <div className="absolute inset-12 bg-gradient-to-br from-green-200 to-green-400 rounded-full shadow-inner border border-gray-300 pointer-events-none">
          <div className="absolute inset-4 bg-gradient-to-br from-green-100 to-green-300 rounded-full pointer-events-none">
            <div className="absolute top-1/2 left-1/2 w-5 h-28 bg-green-800 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-md pointer-events-none">
              <div className="absolute top-1 left-1/2 w-2 h-4 bg-white rounded-full transform -translate-x-1/2 pointer-events-none"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RotativeKnob;
