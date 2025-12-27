
import React, { useState } from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { LogIn, UserPlus, Globe } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError('구글 로그인 실패: ' + err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: nickname || '익명친구' });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError('로그인 실패: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border-4 border-pink-200">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <span className="text-6xl">✨</span>
          </div>
          <h1 className="text-4xl font-extrabold text-pink-500 mb-2">마법의 빙고나라</h1>
          <p className="text-gray-500 text-lg">친구들과 함께 즐거운 빙고 모험을 시작해요!</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-center border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {isRegistering && (
            <input
              type="text"
              placeholder="멋진 닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-5 py-3 rounded-2xl border-2 border-pink-100 focus:border-pink-300 focus:outline-none transition-colors"
              required
            />
          )}
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3 rounded-2xl border-2 border-pink-100 focus:border-pink-300 focus:outline-none transition-colors"
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-3 rounded-2xl border-2 border-pink-100 focus:border-pink-300 focus:outline-none transition-colors"
            required
          />
          <button
            type="submit"
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-2xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isRegistering ? <UserPlus size={20} /> : <LogIn size={20} />}
            {isRegistering ? '회원가입하기' : '빙고나라 입장!'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border-2 border-blue-100 hover:border-blue-300 text-gray-700 font-bold py-3 rounded-2xl shadow-sm transform active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Globe size={20} className="text-blue-500" />
            구글로 로그인하기
          </button>
          
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-pink-400 hover:text-pink-500 text-sm font-bold transition-colors"
          >
            {isRegistering ? '이미 계정이 있나요? 로그인하기' : '아직 계정이 없나요? 가입하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
