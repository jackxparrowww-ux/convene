'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);

  useEffect(() => {
    const isInstant =
      searchParams?.get('instant') === '1' ||
      (typeof window !== 'undefined' && localStorage.getItem('convene_instant') === 'true');

    if (isInstant && !joinInfo) {
      const savedName =
        (typeof window !== 'undefined' && localStorage.getItem('convene_username')) || 'You';

      // Enter the room stage in 0 milliseconds
      setJoinInfo({
        name: savedName,
        stream: null,
        audioOn: true,
        videoOn: true,
      });

      // Acquire media in parallel; stream attaches live as soon as ready
      navigator.mediaDevices
        ?.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        .then((stream) => {
          setJoinInfo((prev) => (prev ? { ...prev, stream } : null));
        })
        .catch(() => {
          /* user proceeds with mic/camera toggleable */
        });
    }
  }, [searchParams, joinInfo]);

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
