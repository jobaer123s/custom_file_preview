/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { BinaryField } from "@web/views/fields/binary/binary_field";
import { PreviewBody } from "./preview_template"; // your dialog body component

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  pdf: "application/pdf",
};

function extFromName(name = "") {
  if (!name) return "";
  const clean = name.split("?")[0].split("#")[0];
  const idx = clean.lastIndexOf(".");
  if (idx === -1 || idx === clean.length - 1) return "";
  return clean.slice(idx + 1).toLowerCase();
}

const EXT2MIME = {
  pdf:  "application/pdf",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
};

function mimeFromName(name = "") {
  const ext = String(name).split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";
  return EXT2MIME[ext] || "";
}

function mimeFromBase64Signature(b64 = "") {
  try {
    const comma = b64.indexOf(",");
    const pure = comma >= 0 ? b64.slice(comma + 1) : b64;
    const bin = atob(pure.slice(0, 64)); // first ~48 bytes are enough
    // signatures
    if (bin.startsWith("%PDF-")) return "application/pdf";                 // PDF
    if (bin.charCodeAt(0) === 0x89 && bin.slice(1,4) === "PNG") return "image/png"; // PNG
    if (bin.charCodeAt(0) === 0xFF && bin.charCodeAt(1) === 0xD8) return "image/jpeg"; // JPEG
    if (bin.startsWith("GIF8")) return "image/gif";                        // GIF
    if (bin.startsWith("RIFF") && bin.slice(8,12) === "WEBP") return "image/webp";     // WEBP
    if ((bin[0] === "I" && bin[1] === "I" && bin.charCodeAt(2) === 0x2A) ||
        (bin[0] === "M" && bin[1] === "M" && bin.charCodeAt(3) === 0x2A)) return "image/tiff";
  } catch (e) { /* ignore */ }
  return "";
}

function isPdfOrImageMime(mime = "") {
  return mime === "application/pdf" || mime.startsWith("image/");
}

function isPdfOrImageByName(name = "") {
  const ext = extFromName(name);
  return !!MIME_BY_EXT[ext];
}

patch(BinaryField.prototype, "custom_file_preview.BinaryPreviewPatch", {
    setup() {
        this._super(...arguments);
        // add services
        this.dialog = useService("dialog");
        this.notification = useService("notification");
    },

    get _meta() {
      const data = this.props.record?.data || {};
      const binField = this.props.name;

      const fileNameField  = this.props.fileNameField  || `${binField}_filename`;
      const mimetypeField  = this.props.mimetypeField  || `${binField}_mimetype`;

      const fileName = data[fileNameField] || data.filename || data.display_name || "";
      let mimetype   = data[mimetypeField] || data.mimetype || "";

      if ((!mimetype || mimetype === "application/octet-stream") && data[binField]) {
        mimetype = mimeFromBase64Signature(data[binField]) || mimetype;
      }
      if (!mimetype || mimetype === "application/octet-stream") {
        mimetype = mimeFromName(fileName) || mimetype;
      }

      return { data, binField, fileName, mimetype };
    },

    get canPreview() {
      const { fileName, mimetype } = this._meta;
      if (isPdfOrImageMime(mimetype)) return true;
      return isPdfOrImageByName(fileName);
    },

    async ks_onAttachmentView(ev) {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      if (!this.canPreview) {
        this.notification.add("Preview is only available for images and PDF files.", { type: "warning" });
        return;
      }

      const record = this.props.record;
      const fieldName = this.props.name;
      const data = record.data || {};
      const fileName =
        data[`${fieldName}_filename`] || data.filename || data.display_name || "file";

      let mimetype =
        data[`${fieldName}_mimetype`] || data.mimetype || "application/octet-stream";

      if (mimetype === "application/octet-stream" || !mimetype) {
        const guessed = mimeFromName(fileName);
        if (guessed) mimetype = guessed;
      }

      if (record.isDirty && data[fieldName]) {
        const dataUrl = `data:${mimetype};base64,${data[fieldName]}`;
        return this._openPreviewDialog(dataUrl, fileName);
      }

      const base = "/web/content";
      const urlParts = [record.resModel, record.resId, fieldName, encodeURIComponent(fileName)].join("/");
      const cacheKey = data[`${fieldName}_checksum`] || data.__last_update || String(Date.now());
      const previewUrl = `${base}/${urlParts}?download=0&unique=${encodeURIComponent(cacheKey)}`;
      this._openPreviewDialog(previewUrl, fileName);
    },

    _openPreviewDialog(url, fileName) {
        const downloadUrl = url.replace("download=0", "download=1");
        console.log('fileName', url,fileName)
        this._previewDialog = this.dialog.add(
            PreviewBody,
            { url, height: "80vh" },
            {
                title: `Preview: ${fileName}`,
                size: "xl",
                buttons: [
                    { text: "Close", close: true, classes: "btn-secondary" },
                    { text: "Download", close: false, classes: "btn-primary",
                      click: () => window.open(downloadUrl, "_blank") },
                ],
            }
        );
    },

    closePreview() {
        this._previewDialog?.close();
    }
});
