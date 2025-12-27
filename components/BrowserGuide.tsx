
import React, { useEffect, useState } from 'react';
import { ExternalLink, Info, Smartphone } from 'lucide-react';

const BrowserGuide: React.FC = () => {
  const [isInApp, setIsInApp] = useState(false);
  const [isKakao, setIsKakao] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isK = ua.indexOf('kakaotalk') !== -1;
    const isLine = ua.indexOf('line') !== -1;
    const isFB = ua.indexOf('fbav') !== -1 || ua.indexOf('fb_iab') !== -1;
    const isInsta = ua.indexOf('instagram') !== -1;
    
    const inApp = isK || isLine || isFB || isInsta;
    setIsInApp(inApp);
    setIsKakao(isK);

    // Automatic redirect for KakaoTalk if possible
    if (isK) {
      const targetUrl = window.location.href;
      // This is a common trick for KakaoTalk in-app browser to force external browser
      if (ua.indexOf('iphone') !== -1 || ua.indexOf('ipad') !== -1 || ua.indexOf('ipod') !== -1) {
        // iOS: No direct way to force Safari easily, but we can try to prompt
      } else {
        // Android: Attempt to force Chrome via Intent
        // window.location.href = `intent://${targetUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
      }
    }
  }, []);

  const handleOpenExternal = () => {
    const currentUrl = window.location.href;
    if (isKakao) {
      window.location.href = `kakaotalk://web/openExternalApp?url=${encodeURIComponent(currentUrl)}`;
    } else {
      // For other browsers, we show instructions
      alert('오른쪽 상단 메뉴(점 세개 또는 아이콘)를 눌러 "브라우저에서 열기" 또는 "Chrome으로 열기"를 선택해주세요! ✨');
    }
  };

  if (!isInApp) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-pink-500/90 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
      <div className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl border-4 border-white text-center space-y-6">
        <div className="relative inline-block">
          <div className="text-7xl mb-2 animate-bounce">🏰</div>
          <div className="absolute -top-2 -right-2 bg-yellow-400 text-white rounded-full p-2 shadow-lg">
            <Info size={20} />
          </div>
        </div>
        
        <h2 className="text-2xl font-black text-gray-800 leading-tight">
          마법의 문이<br />열리지 않나요?
        </h2>
        
        <p className="text-gray-600 font-medium leading-relaxed">
          카카오톡이나 SNS 안의 브라우저에서는<br />
          <span className="text-pink-500 font-bold">로그인이 잘 안 될 수 있어요.</span><br />
          더 안전하고 즐거운 게임을 위해<br />
          <span className="text-blue-500 font-bold">크롬이나 기본 브라우저</span>에서 열어주세요!
        </p>

        <div className="bg-blue-50 rounded-3xl p-4 text-left border-2 border-blue-100">
          <p className="text-blue-600 text-sm font-bold flex items-center gap-2 mb-2">
            <Smartphone size={16} /> 방법 1: 바로가기 버튼
          </p>
          <button 
            onClick={handleOpenExternal}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink size={20} />
            기본 브라우저로 열기
          </button>
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-gray-400 text-xs font-bold flex items-center justify-center gap-2">
            방법 2: 메뉴 이용하기
          </p>
          <div className="flex justify-center gap-4">
            <div className="text-center">
              <div className="bg-gray-100 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1 text-gray-400 font-black">...</div>
              <p className="text-[10px] text-gray-500 font-bold">점 세개 클릭</p>
            </div>
            <div className="flex items-center text-gray-300">→</div>
            <div className="text-center">
              <div className="bg-gray-100 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1 text-gray-400">
                <ExternalLink size={18} />
              </div>
              <p className="text-[10px] text-gray-500 font-bold">브라우저 열기</p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsInApp(false)}
          className="text-gray-400 text-sm font-bold underline decoration-dotted"
        >
          그냥 여기서 계속할게요
        </button>
      </div>
    </div>
  );
};

export default BrowserGuide;
