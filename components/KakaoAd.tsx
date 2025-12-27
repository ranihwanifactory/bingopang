
import React from 'react';

const KakaoAd: React.FC = () => {
  return (
    <div className="flex justify-center items-center w-full bg-transparent py-2 shrink-0 overflow-hidden">
      <ins className="kakao_ad_area" style={{ display: 'none' }}
        data-ad-unit="DAN-2pSxTCwqwbHBQPka"
        data-ad-width="320"
        data-ad-height="100"></ins>
    </div>
  );
};

export default KakaoAd;
