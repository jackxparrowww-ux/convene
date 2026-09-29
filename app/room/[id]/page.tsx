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
  const [isInstantLoading, setIsInstantLoading] = useState(false);

  useEffect(() => {
    const isInstant =
      searchParams?.get('instant') === '1' ||
      (typeof window !== 'undefined' && localStorage.getItem('convene_instant') === 'true');

    if (isInstant && !joinInfo && !isInstantLoading) {
      setIsInstantLoading(true);
      const savedName =
        (typeof window !== 'undefined' && localStorage.getItem('convene_username')) || 'You';

      navigator.mediaDevices
        ?.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        })
        .then((stream) => {
          setJoinInfo({
            name: savedName,
            stream,
            audioOn: true,
            videoOn: true,
          });
        })
        .catch(() => {
          setJoinInfo({
            name: savedName,
            stream: null,
            audioOn: false,
            videoOn: false,
          });
        })
        .finally(() => {
          setIsInstantLoading(false);
        });
    }
  }, [searchParams, joinInfo, isInstantLoading]);

  if (!joinInfo) {
    if (isInstantLoading) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center bg-ink-950 px-4 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
          <p className="mt-5 text-sm font-semibold text-white">Starting instant meeting…</p>
          <p className="mt-1 text-xs text-zinc-500">Connecting media and generating mesh...</p>
        </div>
      );
    }

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
