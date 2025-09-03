'use client';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300); // เลื่อนลงเกิน 300px ถึงจะแสดงปุ่ม
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 p-3 rounded-full shadow-lg transition-all 
      ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'} 
      bg-gray-600 text-white hover:bg-gray-700`}
    >
      <ArrowUp className='w-5 h-5' />
    </button>
  );
}
