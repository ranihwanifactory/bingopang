
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { UserInfo } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-pink-100">
        <div className="animate-bounce">
          <img src="https://picsum.photos/100/100?random=1" className="rounded-full shadow-lg border-4 border-white" alt="Loading" />
          <p className="mt-4 text-pink-500 font-bold text-xl">로딩중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (currentRoomId) {
    return <Game roomId={currentRoomId} user={user} onLeave={() => setCurrentRoomId(null)} />;
  }

  return <Lobby user={user} onJoinRoom={(roomId) => setCurrentRoomId(roomId)} />;
};

export default App;
