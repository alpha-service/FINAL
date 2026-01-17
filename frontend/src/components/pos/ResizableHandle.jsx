import { useEffect, useRef, useState } from 'react';
import { GripVertical, GripHorizontal } from 'lucide-react';

export default function ResizableHandle({ onResize, direction = 'vertical', containerRef, minPercent = 30, maxPercent = 70 }) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startPercentRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      
      let newPercent;
      if (direction === 'vertical') {
        // Vertical divider (horizontal layouts)
        const containerWidth = rect.width;
        const mouseX = e.clientX - rect.left;
        newPercent = (mouseX / containerWidth) * 100;
      } else {
        // Horizontal divider (vertical layouts)
        const containerHeight = rect.height;
        const mouseY = e.clientY - rect.top;
        newPercent = (mouseY / containerHeight) * 100;
      }
      
      // Constrain to min/max
      newPercent = Math.max(minPercent, Math.min(maxPercent, newPercent));
      onResize(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, containerRef, minPercent, maxPercent, onResize]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    if (direction === 'vertical') {
      startPosRef.current = e.clientX;
    } else {
      startPosRef.current = e.clientY;
    }
  };

  const isVertical = direction === 'vertical';

  return (
    <div
      className={`
        relative flex-shrink-0 bg-slate-200 hover:bg-brand-orange transition-colors group z-10
        ${isVertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        ${isDragging ? 'bg-brand-orange' : ''}
      `}
      onMouseDown={handleMouseDown}
    >
      <div className={`
        absolute ${isVertical ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'}
        bg-slate-400 group-hover:bg-brand-orange rounded-full p-1 transition-colors
        ${isDragging ? 'bg-brand-orange' : ''}
      `}>
        {isVertical ? (
          <GripVertical className="w-3 h-3 text-white" />
        ) : (
          <GripHorizontal className="w-3 h-3 text-white" />
        )}
      </div>
    </div>
  );
}
