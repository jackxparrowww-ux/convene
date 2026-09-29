'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PreJoin, { type JoinInfo } from '@/components/PreJoin';
import MeetingRoom from '@/components/MeetingRoom';

/** Creator host key lives in the URL hash: `#host=<key>`. Never copied
 *  into invite links — guests join without it. */
function hostKeyFromHash(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const m = window.location.hash.match(/#host=([A-Za-z0-9_-]{8,64})/);
  return m ? m[1] : undefined;
}

export default function RoomPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);

  if (!joinInfo) {
    return (
      <PreJoin
        roomId={params.id}
        onJoin={setJoinInfo}
        onBack={() => router.push('/')}
      />
    );
  }

  return (
    <MeetingRoom
      roomId={params.id}
      name={joinInfo.name}
      stream={joinInfo.stream}
      audioOn={joinInfo.audioOn}
      videoOn={joinInfo.videoOn}
      hostKey={hostKeyFromHash()}
      onExit={() => router.push('/')}
    />
  );
}
