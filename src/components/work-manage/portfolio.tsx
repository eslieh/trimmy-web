'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Lightbox } from '@/components/ui/lightbox';
import { Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { ConfirmModal, ErrorBlock, Loading, SectionTitle } from './shared';
import { useApi } from './use-api';

type PortfolioPhoto = { photoId: string; staffId: string; url: string; createdAt: string };
type Portfolio = { staffId: string; photos: PortfolioPhoto[]; maxPhotos: number };

const MAX_BYTES = 10 * 1024 * 1024; // the server's limit
const TYPES = ['image/jpeg', 'image/png'];

// A staff member's portfolio: photos of their work, shown on their profile
// (the business page's team sheet). The owner manages anyone's; members also
// manage their own from the app. Uploads go through the API as multipart,
// like business photos, so storage needs no CORS setup.
export function PortfolioPanel({ staffId, name }: { staffId: string; name?: string }) {
  const { businessId } = useWork();
  const path = `/businesses/${businessId}/staff/${staffId}/portfolio`;
  const { data, error, loading, reload, mutate } = useApi<Portfolio>(path);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [removing, setRemoving] = useState<PortfolioPhoto | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  const photos = data?.photos ?? [];
  const room = data ? data.maxPhotos - photos.length : 0;

  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (input.current) input.current.value = '';
    if (!list.length) return;
    const ok = list.filter((f) => {
      if (!TYPES.includes(f.type)) {
        toast.error(`${f.name}: only JPEG or PNG photos.`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is over 10 MB.`);
        return false;
      }
      return true;
    });
    if (ok.length > room) toast.error(`Only ${room} more fit; the first ${room} are being added.`);
    const batch = ok.slice(0, room);
    setUploading(batch.length);
    let done = 0;
    // One at a time: kinder to slow connections than a burst of parallel uploads.
    for (const file of batch) {
      const form = new FormData();
      form.append('photo', file);
      try {
        const photo = await api<PortfolioPhoto>(path, { method: 'POST', body: form });
        mutate((d) => ({ ...d, photos: [photo, ...d.photos] }));
        done += 1;
      } catch (err) {
        toast.error(errorMessage(err, `Couldn't upload ${file.name}.`));
      }
      setUploading((n) => n - 1);
    }
    if (done) toast.success(done === 1 ? 'Photo added' : `${done} photos added`);
  };

  const whose = name ? `${name}'s` : 'your';
  return (
    <Card>
      <SectionTitle
        title="Portfolio"
        subtitle={`Photos of ${whose} work. Customers see them on the profile when choosing who to book.`}
        action={
          data && room > 0 ? (
            <Button size="sm" onClick={() => input.current?.click()} loading={uploading > 0} disabled={uploading > 0}>
              {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
            </Button>
          ) : null
        }
      />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="sr-only"
        aria-label="Choose portfolio photos"
        onChange={(e) => upload(e.target.files)}
      />
      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label="Loading photos…" />
      ) : (
        <>
          {photos.length === 0 && uploading === 0 ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-3xl bg-accent-soft/60 px-6 py-10 text-center transition-colors hover:bg-accent-soft"
            >
              <span className="font-bold tracking-tight text-accent-foreground">Add the first photos</span>
              <span className="text-sm text-ink-2">Clear, well-lit photos of finished looks. JPEG or PNG, up to 10 MB each.</span>
            </button>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: uploading }, (_, i) => (
                <li key={`up-${i}`} className="grid aspect-square place-items-center rounded-2xl bg-accent-soft/60 text-accent-foreground">
                  <Spinner />
                </li>
              ))}
              {photos.map((p, i) => (
                <li key={p.photoId} className="group relative aspect-square overflow-hidden rounded-2xl bg-surface-3">
                  <button type="button" onClick={() => setViewing(i)} className="absolute inset-0" aria-label={`View photo ${i + 1} of ${photos.length}`}>
                    <Image src={p.url} alt="Portfolio photo" fill sizes="(min-width: 640px) 160px, 33vw" className="object-cover" unoptimized={!p.url.startsWith('https://')} />
                  </button>
                  <button
                    onClick={() => setRemoving(p)}
                    className="absolute top-2 right-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-danger shadow-card opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    aria-label="Remove photo"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data ? (
            <p className="mt-3 text-sm text-ink-2">
              {photos.length} of {data.maxPhotos} photos{room <= 0 ? ' · full. Remove one to add another.' : ''}
            </p>
          ) : null}
        </>
      )}
      <Lightbox images={photos.map((p) => p.url)} index={viewing} onClose={() => setViewing(null)} label={name ? `${name}'s work` : 'Your work'} />
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this photo?"
        body="It comes off the profile straight away."
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(`${path}/${removing.photoId}`, { method: 'DELETE' });
            mutate((d) => ({ ...d, photos: d.photos.filter((x) => x.photoId !== removing.photoId) }));
            toast.success('Photo removed');
            setRemoving(null);
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't remove it."));
          }
        }}
      />
    </Card>
  );
}
