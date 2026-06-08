import React, { useRef, useState, useEffect } from 'react';
import { useAudio } from '../../context/AudioContext';

interface RotativeKnobProps {
  onValueChange?: (value: number) => void;
  initialValue?: number;
}

const RotativeKnob: React.FC<RotativeKnobProps> = ({
  onValueChange,
  initialValue = 0,
}) => {
  const [rotaryValue, setRotaryValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const rotaryRef = useRef<HTMLDivElement>(null);
  const audioService = useAudio();
  const canVibrate = ('vibrate' in navigator);
  // Refs to store initial angles for relative rotation calculation
  const initialKnobAngleRef = useRef(0);
  const initialMouseAngleRef = useRef(0);

  useEffect(() => {
    setRotaryValue(initialValue);
  }, [initialValue]);

  
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

  // Finds the closest predefined snap angle to a given target angle.
  const findClosestAngle = (targetAngle: number) => {
    let minDifference = 360;
    let closestAngle = predefinedAngles[0].angle;

    predefinedAngles.forEach(({ angle }) => {
      // Normalize angles to be within a consistent range for comparison
      const normalizedTarget = (targetAngle % 360 + 360) % 360;
      const normalizedAngle = (angle % 360 + 360) % 360;

      const diff = Math.abs(normalizedTarget - normalizedAngle);
      const difference = Math.min(diff, 360 - diff);

      if (difference < minDifference) {
        minDifference = difference;
        closestAngle = angle;
      }
    });

    return closestAngle;
  };

  // Gets cross-platform event coordinates for both mouse and touch events.
  const getEventCoordinates = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  // Calculates the angle of the cursor relative to the center of the knob.
  const calculateAngle = (e: MouseEvent | TouchEvent) => {
    if (!rotaryRef.current) return 0;
    const { clientX, clientY } = getEventCoordinates(e);
    const rect = rotaryRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angleRad = Math.atan2(clientY - centerY, clientX - centerX);
    // Add 90 degrees to align the 0-degree mark to the top
    return (angleRad * 180) / Math.PI + 90;
  };

  // Handles the start of a drag interaction.
  const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    // Store the initial angles when drag starts
    initialKnobAngleRef.current = rotaryValue;
    initialMouseAngleRef.current = calculateAngle(e as any);
  };

  // Handles the movement during a drag interaction.
  const handleInteractionMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const currentMouseAngle = calculateAngle(e);
    let angleDelta = currentMouseAngle - initialMouseAngleRef.current;

    // Handle the angle wrapping around 360 degrees
    if (angleDelta > 180) angleDelta -= 360;
    if (angleDelta < -180) angleDelta += 360;

    const newAngle = initialKnobAngleRef.current + angleDelta;
    const closestSnapAngle = findClosestAngle(newAngle);

    // Prevent wrap-around from the last to the first item and vice-versa.
    const firstAngle = predefinedAngles[0].angle;
    const lastAngle = predefinedAngles[predefinedAngles.length - 1].angle;
    const isWrappingForward = rotaryValue === lastAngle && closestSnapAngle === firstAngle;
    const isWrappingBackward = rotaryValue === firstAngle && closestSnapAngle === lastAngle;

    if (isWrappingForward || isWrappingBackward) {
      return; // Do not update if it's a wrap-around
    }
  

    if (closestSnapAngle !== rotaryValue) {
      if (canVibrate) navigator.vibrate(1);
      audioService.playClickSound("normal");
      setRotaryValue(closestSnapAngle);
      onValueChange?.(closestSnapAngle);
    }
  };

  // Handles the end of an interaction.
  const handleInteractionEnd = () => {
    setIsDragging(false);
  };

  // Effect to add and remove global event listeners for dragging.
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => handleInteractionMove(e);
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        handleInteractionMove(e);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleInteractionEnd);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleInteractionEnd);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleInteractionEnd);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleInteractionEnd);
      };
    }
  }, [isDragging, rotaryValue]); // rotaryValue added to dependencies

  return (
    <div className="relative mt-6 -ml-5">
      <div className="absolute inset-0 w-56 h-56">
        {predefinedAngles
          .map((item) => (
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
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
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
