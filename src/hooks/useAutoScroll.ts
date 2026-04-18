import { useEffect, useRef } from 'react';

export function useAutoScroll(isActive: boolean, speed = 2) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const el = scrollRef.current;
    if (!el) return;

    let animationFrameId: number;
    let delayTimeout: NodeJS.Timeout;
    let isWaiting = false;

    const scroll = () => {
      if (isWaiting) {
        animationFrameId = requestAnimationFrame(scroll);
        return;
      }

      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        isWaiting = true;
        delayTimeout = setTimeout(() => {
          el.scrollTop = 0;
          isWaiting = false;
        }, 3000); // 到底部停留3秒后回到顶部
      } else {
        el.scrollTop += speed;
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    // 稍微延迟启动，等待内容渲染
    const startTimeout = setTimeout(() => {
      animationFrameId = requestAnimationFrame(scroll);
    }, 1000);

    return () => {
      clearTimeout(startTimeout);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(delayTimeout);
    };
  }, [isActive, speed]);

  return scrollRef;
}
