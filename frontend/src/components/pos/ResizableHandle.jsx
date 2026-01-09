import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

export default function ResizableHandle({ onResize, minWidth, maxWidth }) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const delta = startXRef.current - e.clientX;
      const newWidth = startWidthRef.current + delta;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        onResize(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, onResize]);

  const handleMouseDown = (e, currentWidth) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
  };

  return (
    <div
      className={`
        absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20
        hover:bg-brand-orange transition-colors
        ${isDragging ? 'bg-brand-orange' : 'bg-slate-300'}
      `}
      onMouseDown={(e) => {
        const cartWidth = parseInt(
          window.getComputedStyle(e.target.parentElement).width
        );
        handleMouseDown(e, cartWidth);
      }}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-400 rounded-full p-1">
        <GripVertical className="w-3 h-3 text-white" />
      </div>
    </div>
  );
}
