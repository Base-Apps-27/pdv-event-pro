import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Phase 7: Memoized — lightweight wrapper, prevents cascading re-renders
const AnimatedSortableItem = React.memo(function AnimatedSortableItem({
  children,
  id,
  isHighlighted,
  className,
}) {
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      setHighlight(true);
      const timer = setTimeout(() => {
        setHighlight(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  return (
    <motion.div
      layoutId={id}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      className={cn(
        'relative',
        highlight && 'ring-2 ring-blue-500 shadow-lg transition-all duration-700',
        className
      )}
    >
      {children}
    </motion.div>
  );
});

export default AnimatedSortableItem;