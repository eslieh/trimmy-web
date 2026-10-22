'use client';

import { useRef, useState } from 'react';
import { useSession } from '@/components/session';
import { Spinner } from '@/components/ui/button';
import { Avatar } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/types/api';

const MAX_BYTES = 10 * 1024 * 1024; // the server's limit
const UPLOAD_SIDE = 1024; // the server keeps 512px; no need to send more

// The profile picture on the account page: choose one, use the Google
// account's picture, or remove it. Saved straight away (the server crops it
// square and stores one small JPEG), then the session refreshes so the header
// menu shows it too.
export function PhotoForm({ user, name, children }: { user: User; name: string; children?: React.ReactNode }) {
  const { refresh } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<User>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update your photo."));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast.error('Choose a JPEG or PNG photo.');
    if (file.size > MAX_BYTES) return toast.error('That photo is over 10 MB.');
    await run(async () => {
      const form = new FormData();
      form.append('photo', await shrinkForUpload(file));
      return api<User>('/auth/me/avatar', { method: 'PUT', body: form });
    }, 'Photo updated');
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="relative shrink-0 rounded-full"
        aria-label="Change profile picture"
      >
        <Avatar name={name} src={user.avatar_url} size={72} />
        {busy ? (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/45 text-white">
            <Spinner className="size-5" />
          </span>
        ) : null}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label="Choose a profile picture"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div className="min-w-0">
        {children}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="text-brand hover:underline">
            {user.avatar_url ? 'Change photo' : 'Add a photo'}
          </button>
          {user.has_google_picture ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api<User>('/auth/me/avatar/google', { method: 'POST' }), 'Using your Google photo')}
              className="text-brand hover:underline"
            >
              Use Google photo
            </button>
          ) : null}
          {user.avatar_url ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api<User>('/auth/me/avatar', { method: 'DELETE' }), 'Photo removed')}
              className="text-danger hover:underline"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Big camera photos are scaled down in the browser first: less to send on a
// slow connection. Small ones (or if the browser can't) go as they are.
async function shrinkForUpload(file: File): Promise<Blob> {
  if (file.size < 1024 * 1024 || typeof createImageBitmap === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, UPLOAD_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}
