"use client";

import { Check, ImagePlus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listMediaAssetsAction, uploadMediaAction } from "../media.actions";
import { acceptAttributeForUsage, mediaUsageTypes, type MediaUsageType } from "../media.schema";
import type { MediaPickerAsset } from "../media.types";

type MediaPickerProps = {
  multiple?: boolean;
  onClose: () => void;
  onSelect: (assets: MediaPickerAsset[]) => void;
  open: boolean;
  title?: string;
  usageType: MediaUsageType;
};

type MediaPickerFieldProps = {
  description?: string;
  label: string;
  name: string;
  // Supply this to let a parent own the value (product slots fill each other);
  // leave it off and the field keeps its own state.
  onChange?: ((url: string) => void) | undefined;
  usageType: MediaUsageType;
  value?: string | null | undefined;
};

const usageLabels: Record<MediaUsageType, string> = {
  CATEGORY: "Category images",
  FAVICON: "Favicons",
  GENERAL: "General",
  HERO: "Hero images",
  LOGO: "Logos",
  PRODUCT: "Product images"
};

/**
 * WordPress-style media modal: the existing library on one tab, an upload on the
 * other, both scoped to the current store and to the mime types the usage allows.
 */
export function MediaPicker({
  multiple = false,
  onClose,
  onSelect,
  open,
  title = "Media Library",
  usageType
}: MediaPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [assets, setAssets] = useState<MediaPickerAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Each opening starts clean so a previous pick never leaks into the next one.
  useEffect(() => {
    if (!open) {
      return;
    }

    setTab("library");
    setSelectedIds([]);
    setSearch("");
    setUsageFilter("");
    setPendingFile(null);
    setAltText("");
    setUploadError(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Typing in the search box shouldn't fire a request per keystroke.
    const timer = setTimeout(
      () => {
        listMediaAssetsAction({
          context: usageType,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(usageFilter ? { usageType: usageFilter as MediaUsageType } : {})
        })
          .then((page) => {
            if (cancelled) {
              return;
            }

            setAssets(page.assets);
            setNextCursor(page.nextCursor);
            setListError(null);
          })
          .catch(() => {
            if (!cancelled) {
              setListError("Could not load the media library.");
            }
          })
          .finally(() => {
            if (!cancelled) {
              setLoading(false);
            }
          });
      },
      search ? 250 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, search, usageFilter, usageType]);

  async function loadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);

    try {
      const page = await listMediaAssetsAction({
        context: usageType,
        cursor: nextCursor,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(usageFilter ? { usageType: usageFilter as MediaUsageType } : {})
      });

      setAssets((current) => [...current, ...page.assets]);
      setNextCursor(page.nextCursor);
    } catch {
      setListError("Could not load more media.");
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleAsset(assetId: string) {
    setSelectedIds((current) => {
      if (current.includes(assetId)) {
        return current.filter((id) => id !== assetId);
      }

      return multiple ? [...current, assetId] : [assetId];
    });
  }

  async function handleUpload() {
    if (!pendingFile || uploading) {
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.set("file", pendingFile);
      formData.set("usageType", usageType);

      if (altText.trim()) {
        formData.set("alt", altText.trim());
      }

      const result = await uploadMediaAction(formData);

      if (result.status === "error") {
        setUploadError(result.message);
        return;
      }

      const { asset } = result;

      setAssets((current) => [asset, ...current.filter((entry) => entry.id !== asset.id)]);
      setSelectedIds((current) => (multiple ? [...current, asset.id] : [asset.id]));
      setPendingFile(null);
      setAltText("");
      setTab("library");
    } catch {
      setUploadError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function confirmSelection() {
    const chosen = selectedIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset): asset is MediaPickerAsset => Boolean(asset));

    if (chosen.length === 0) {
      return;
    }

    onSelect(chosen);
    onClose();
  }

  if (!open || !mounted) {
    return null;
  }

  const dialog = (
    <div className="media-picker-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="media-picker-title"
        aria-modal="true"
        className="media-picker-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="media-picker-header">
          <h2 id="media-picker-title">{title}</h2>
          <button aria-label="Close media library" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="media-picker-tabs">
          <button
            className={tab === "library" ? "is-active" : ""}
            onClick={() => setTab("library")}
            type="button"
          >
            Media Library
          </button>
          <button
            className={tab === "upload" ? "is-active" : ""}
            onClick={() => setTab("upload")}
            type="button"
          >
            Upload new
          </button>
        </div>

        {tab === "library" ? (
          <>
            <div className="media-picker-toolbar">
              <input
                aria-label="Search media"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by file name or alt text"
                type="search"
                value={search}
              />
              <select
                aria-label="Filter by usage"
                onChange={(event) => setUsageFilter(event.target.value)}
                value={usageFilter}
              >
                <option value="">All usages</option>
                {mediaUsageTypes.map((usage) => (
                  <option key={usage} value={usage}>
                    {usageLabels[usage]}
                  </option>
                ))}
              </select>
            </div>

            <div className="media-picker-body">
              {listError ? <p className="form-error">{listError}</p> : null}
              {loading ? <p className="media-picker-status">Loading media...</p> : null}
              {!loading && assets.length === 0 ? (
                <div className="media-picker-blank">
                  <ImagePlus className="h-8 w-8" />
                  <p>{search || usageFilter ? "No media matches this filter." : "No media yet."}</p>
                  <button onClick={() => setTab("upload")} type="button">
                    Upload an image
                  </button>
                </div>
              ) : null}
              {!loading && assets.length > 0 ? (
                <div className="media-picker-grid">
                  {assets.map((asset) => {
                    const selected = selectedIds.includes(asset.id);

                    return (
                      <button
                        aria-pressed={selected}
                        className={selected ? "media-picker-tile is-selected" : "media-picker-tile"}
                        key={asset.id}
                        onClick={() => toggleAsset(asset.id)}
                        // The two clicks underneath have already toggled the
                        // tile back off, so confirm this asset directly.
                        onDoubleClick={() => {
                          onSelect([asset]);
                          onClose();
                        }}
                        type="button"
                      >
                        <span className="media-picker-thumb">
                          <img alt={asset.alt ?? asset.filename} src={asset.url} />
                          {selected ? (
                            <span className="media-picker-check">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : null}
                        </span>
                        <span className="media-picker-filename">{asset.filename}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {nextCursor && !loading ? (
                <div className="media-picker-more">
                  <button disabled={loadingMore} onClick={loadMore} type="button">
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="media-picker-body">
            <label
              className={dragging ? "media-picker-dropzone is-dragging" : "media-picker-dropzone"}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);

                const file = event.dataTransfer.files?.[0];

                if (file) {
                  setPendingFile(file);
                  setUploadError(null);
                }
              }}
            >
              <Upload className="h-6 w-6" />
              <strong>{pendingFile ? pendingFile.name : "Drop an image here or browse"}</strong>
              <span>Up to 5MB.</span>
              <input
                accept={acceptAttributeForUsage(usageType)}
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    setPendingFile(file);
                    setUploadError(null);
                  }
                }}
                type="file"
              />
            </label>
            <label className="media-picker-alt">
              Alt text (optional)
              <input
                onChange={(event) => setAltText(event.target.value)}
                placeholder="Describe the image"
                type="text"
                value={altText}
              />
            </label>
            {uploadError ? <p className="form-error">{uploadError}</p> : null}
            <div className="media-picker-more">
              <button disabled={!pendingFile || uploading} onClick={handleUpload} type="button">
                {uploading ? "Uploading..." : "Upload image"}
              </button>
            </div>
          </div>
        )}

        <footer className="media-picker-footer">
          <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : "Nothing selected"}</span>
          <div>
            <button className="media-picker-cancel" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="media-picker-confirm"
              disabled={selectedIds.length === 0}
              onClick={confirmSelection}
              type="button"
            >
              {multiple ? "Use images" : "Use image"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );

  return createPortal(dialog, document.body);
}

/**
 * Form-bound wrapper: keeps the hidden-input contract the server actions already
 * read, so adopting it in a form is a straight swap for the old upload field.
 */
export function MediaPickerField({
  description,
  label,
  name,
  onChange,
  usageType,
  value
}: MediaPickerFieldProps) {
  const [selectedUrl, setSelectedUrl] = useState(value ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSelectedUrl(value ?? "");
  }, [value]);

  function applyUrl(url: string) {
    setSelectedUrl(url);
    onChange?.(url);
  }

  return (
    <div className="media-picker-field">
      <input name={name} type="hidden" value={selectedUrl} />
      <div className="theme-upload-label-row">
        <span>{label}</span>
        {selectedUrl ? (
          <button className="theme-upload-remove" onClick={() => applyUrl("")} type="button">
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        ) : null}
      </div>
      <div className="theme-upload-box">
        <div className="theme-upload-preview">
          {selectedUrl ? (
            <img alt={`${label} preview`} src={selectedUrl} />
          ) : (
            <ImagePlus className="h-8 w-8" />
          )}
        </div>
        <div className="media-picker-field-actions">
          <button className="media-picker-choose" onClick={() => setOpen(true)} type="button">
            {selectedUrl ? "Replace image" : "Choose image"}
          </button>
          <p>{description ?? "Pick from your media library or upload a new image."}</p>
        </div>
      </div>
      <MediaPicker
        onClose={() => setOpen(false)}
        onSelect={(picked) => {
          const first = picked[0];

          if (first) {
            applyUrl(first.url);
          }
        }}
        open={open}
        title={`Select ${label}`}
        usageType={usageType}
      />
    </div>
  );
}
