import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import type { MediaAssetListItem } from "../media.types";
import { deleteMediaFormAction } from "../media.actions";
import { MediaCopyButton } from "./media-copy-button";

type MediaLibraryProps = {
  assets: MediaAssetListItem[];
};

export function MediaLibrary({ assets }: MediaLibraryProps) {
  if (assets.length === 0) {
    return (
      <div className="empty-state">
        <h2>No media yet</h2>
        <p>Upload logos, hero images, and product photos to build your shared media library.</p>
      </div>
    );
  }

  return (
    <div className="media-grid">
      {assets.map((asset) => (
        <article className="media-card" key={asset.id}>
          <div className="media-preview">
            <img alt={asset.alt ?? asset.filename} src={asset.url} />
          </div>
          <div className="media-card-body">
            <strong>{asset.filename}</strong>
            <span>{asset.usageType?.toLowerCase() ?? "general"}</span>
            <span>{formatBytes(asset.size)}</span>
          </div>
          <div className="table-actions media-actions">
            <MediaCopyButton url={asset.url} />
            <DeleteConfirmationButton
              action={deleteMediaFormAction.bind(null, asset.id)}
              ariaLabel={`Delete ${asset.filename}`}
              title="Delete image"
            >
              Delete
            </DeleteConfirmationButton>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
