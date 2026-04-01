import React from 'react';

const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-[32px] bg-[#091328]/90 dark:bg-[#091328]/90 backdrop-blur-2xl shadow-[0px_-10px_30px_rgba(0,0,0,0.3)] flex justify-around items-center px-8 pb-8 pt-4">
      <div className="flex flex-col items-center justify-center bg-[#141f38] text-[#62fae3] rounded-full px-6 py-2 shadow-[0_0_15px_rgba(98,250,227,0.15)] transition-all">
        <span className="material-symbols-outlined mb-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>waves</span>
        <span className="font-['Inter'] font-medium text-[11px] uppercase tracking-widest">Session</span>
      </div>
    </nav>
  );
};

export default BottomNav;
