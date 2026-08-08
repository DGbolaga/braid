import { WeaveMark } from "@/components/brand/weave-mark";

/**
 * No chrome. Centred single column, max 720. Most applicants arrive from a
 * WhatsApp link on a phone, so this has to work at 360px.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-page">
      <div className="mx-auto flex w-full max-w-public flex-1 flex-col gap-32 px-16 py-32">
        <span className="flex items-center gap-8">
          <WeaveMark size={32} id="public-mark" />
          <span className="type-heading-s text-primary">Braid</span>
        </span>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-subtle pt-16 type-caption text-muted">
          Braid
        </footer>
      </div>
    </div>
  );
}
