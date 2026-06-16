
import { useAudio } from '@/app/context/AudioContext';
import React, { useState, useRef, useMemo, useEffect } from 'react';

interface JoystickProps {
  onStepUp?: () => void;
  onStepDown?: () => void;
  onClick?: () => void;
  size?: number;
  numberOfSteps?: number;
}

const Joystick: React.FC<JoystickProps> = ({
  onStepUp,
  onStepDown,
  onClick,
  size = 120,
  numberOfSteps = 16,
}) => {
  const [angle, setAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const joystickRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const audioService = useAudio();
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const snapAngles = useMemo(() => {
    if (numberOfSteps <= 0) return [0];
    const stepAngle = 360 / numberOfSteps;
    return Array.from({ length: numberOfSteps }, (_, i) => i * stepAngle);
  }, [numberOfSteps]);

  const findClosestSnapAngle = (targetAngle: number) => {
    let minDifference = 360;
    let closestAngle = snapAngles[0];

    snapAngles.forEach((snapAngle) => {
      const diff = Math.abs(targetAngle - snapAngle);
      const difference = Math.min(diff, 360 - diff);

      if (difference < minDifference) {
        minDifference = difference;
        closestAngle = snapAngle;
      }
    });

    return closestAngle;
  };

  const calculateAngleFromPoint = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return 0;

    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angleRad = Math.atan2(clientY - centerY, clientX - centerX);
    const angleDeg = (angleRad * 180) / Math.PI + 90;

    return (angleDeg + 360) % 360;
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // ne démarre pas un drag si on clique avec un autre doigt/pointeur
    if (activePointerIdRef.current !== null) return;

    activePointerIdRef.current = e.pointerId;
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // rien
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (activePointerIdRef.current !== e.pointerId) return;

    e.preventDefault();

    const currentPointerAngle = calculateAngleFromPoint(e.clientX, e.clientY);
    const newSnapAngle = findClosestSnapAngle(currentPointerAngle);

    if (newSnapAngle !== angle) {
      if (canVibrate) navigator.vibrate(1);
      audioService.playClickSound('soft');

      const oldIndex = snapAngles.indexOf(angle);
      const newIndex = snapAngles.indexOf(newSnapAngle);

      if (oldIndex === 0 && newIndex === snapAngles.length - 1) {
        onStepUp?.();
      } else if (oldIndex === snapAngles.length - 1 && newIndex === 0) {
        onStepDown?.();
      } else if (newIndex > oldIndex) {
        onStepDown?.();
      } else {
        onStepUp?.();
      }

      setAngle(newSnapAngle);
    }
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // rien
    }

    activePointerIdRef.current = null;
    setIsDragging(false);
  };

  const handleCenterPress = () => {
    if (canVibrate) navigator.vibrate(10);
    audioService.playClickSound('normal');
    onClick?.();

    setIsPressed(true);
    window.setTimeout(() => {
      setIsPressed(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      activePointerIdRef.current = null;
    };
  }, []);

  return (
    <div className="flex items-center justify-center">
      <div
        ref={joystickRef}
        className="rounded-full shadow-lg bg-gray-900 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          touchAction: 'none',
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handlePointerMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: isDragging ? 'none' : 'transform 0.12s ease-out',
          }}
        >
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              handleCenterPress();
            }}
            className={`absolute rounded-full bg-black transition-all duration-150 cursor-pointer flex items-center justify-center z-10 ${
              isPressed ? 'shadow-inner scale-95 bg-gray-800' : 'shadow-md'
            }`}
            style={{
              width: `${size * 0.3}px`,
              height: `${size * 0.3}px`,
              touchAction: 'manipulation',
            }}
          >
            <div
              className="absolute w-1 h-3 bg-gray-300 rounded-full"
              style={{
                left: '50%',
                top: '10%',
                transform: 'translateX(-50%)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Joystick;