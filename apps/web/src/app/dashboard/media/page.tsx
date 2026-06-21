import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { MediaLibrary } from "../../../modules/media/components/media-library";
import { MediaUploadForm } from "../../../modules/media/components/media-upload-form";
import { uploadMediaFormAction } from "../../../modules/media/media.actions";
import { getMediaAssetsForStore } from "../../../modules/media/media.service";
import { requireStore } from "../../../modules/stores/queries";

type MediaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const store = await requireStore();
  const assets = await getMediaAssetsForStore(store.id);
  const params = await searchParams;
  const message = params.uploaded ? "Image uploaded." : params.deleted ? "Image deleted." : null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Media</p>
            <h1>Media library</h1>
            <p className="auth-copy">
              Upload and manage store-scoped images for products, logos, favicons, and storefront hero sections.
            </p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="dashboard-shell media-upload-shell">
          <MediaUploadForm action={uploadMediaFormAction} />
        </div>
        <MediaLibrary
          assets={assets.map((asset) => ({
            alt: asset.alt,
            createdAt: asset.createdAt,
            filename: asset.filename,
            height: asset.height,
            id: asset.id,
            mimeType: asset.mimeType,
            size: asset.size,
            url: asset.url,
            usageType: asset.usageType,
            width: asset.width
          }))}
        />
      </section>
    </DashboardShell>
  );
}
