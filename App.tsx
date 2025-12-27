
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Lobby from './components/Lobby';
import Game from './components/Game';
import BrowserGuide from './components/BrowserGuide';
import { UserInfo } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for room ID in URL on load
    const params = new URLSearchParams(window.location.search);
    const roomIdParam = params.get('room');
    if (roomIdParam) {
      setCurrentRoomId(roomIdParam);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
    // Sync URL with room state
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url);
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-pink-100">
        <div className="animate-bounce text-center">
          <img src="https://picsum.photos/100/100?random=1" className="rounded-full shadow-lg border-4 border-white mx-auto" alt="Loading" />
          <p className="mt-4 text-pink-500 font-bold text-xl">마법 가루를 뿌리는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <BrowserGuide />
      {!user ? (
        <Login />
      ) : currentRoomId ? (
        <Game roomId={currentRoomId} user={user} onLeave={handleLeaveRoom} />
      ) : (
        <Lobby user={user} onJoinRoom={handleJoinRoom} />
      )}
    </>
  );
};

export default App;
