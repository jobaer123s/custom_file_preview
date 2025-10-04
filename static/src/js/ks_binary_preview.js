/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { BinaryField } from "@web/views/fields/binary/binary_field";
import { PreviewBody } from "./preview"; // your dialog body component

// helpers
const IMAGE_EXTS = new Set(["png","jpg","jpeg","gif","bmp","webp","svg"]);
const isPdfOrImageMime = (mt="") => mt === "application/pdf" || mt.startsWith("image/");
const isPdfOrImageByName = (name="") => {
    const ext = String(name || "").split(".").pop().toLowerCase();
    return ext === "pdf" || IMAGE_EXTS.has(ext);
};
const sniffMimeFromBase64 = (b64="") => {
    const h = b64.slice(0, 16);
    if (h.startsWith("JVBERi0")) return "application/pdf"; // %PDF-
    if (h.startsWith("/9j/"))     return "image/jpeg";
    if (h.startsWith("iVBORw0"))  return "image/png";
    if (h.startsWith("R0lGOD"))   return "image/gif";
    if (h.startsWith("UklGR"))    return "image/webp";
    return "";
};

patch(BinaryField.prototype, "custom_file_preview.BinaryPreviewPatch", {
    setup() {
        // call original setup
        this._super(...arguments);
        // add services
        this.dialog = useService("dialog");
        this.notification = useService("notification");
    },
    // ✅ single source of truth for whether preview is allowed
    get _meta() {
        const data = this.props.record?.data || {};
        const binField = this.props.name;

        // dynamic fields coming from props (preferred)
        const fileNameField = this.props.fileNameField || `${binField}_filename`;
        const mimetypeField = this.props.mimetypeField || `${binField}_mimetype`;

        let fileName = data[fileNameField] || data.filename || data.display_name || "";
        let mimetype = data[mimetypeField] || data.mimetype || "";

        // if still unknown and record is dirty, sniff in-memory base64 to detect image/pdf
        if ((!mimetype || mimetype === "application/octet-stream") &&
            this.props.record?.isDirty && data[binField]) {
            mimetype = sniffMimeFromBase64(data[binField]) || mimetype;
        }
        return { data, binField, fileName, mimetype };
    },

    // ✅ single source of truth for whether preview is allowed (PDF + images only)
    get canPreview() {
        const { fileName, mimetype } = this._meta;
        if (isPdfOrImageMime(mimetype)) return true;
        if (!mimetype || mimetype === "application/octet-stream") {
            return isPdfOrImageByName(fileName);
        }
        return false;
    },

    async ks_onAttachmentView(ev) {
        console.log('ks_onAttachmentView jhh', ev);
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        // 🚫 Hard stop if not pdf/image
        if (!this.canPreview) {
            this.notification.add(
                "Preview is only available for images and PDF files.",
                { type: "warning" }
            );
            return;
        }
        const record = this.props.record;
        const fieldName = this.props.name;
        const data = record.data || {};

        const fileName =
            data[`${fieldName}_filename`] ||
            data.filename ||
            data.display_name ||
            "file";

        // Close previous dialog safely (dialog.add returns a function)
        if (typeof this._previewDialog === "function") {
            this._previewDialog();
            this._previewDialog = null;
        }

        let mimetype =
            data[`${fieldName}_mimetype`] ||
            data.mimetype ||
            "application/octet-stream";

        // naive guess if still unknown
        if (mimetype === "application/octet-stream") {
            const ext = String(fileName).split(".").pop().toLowerCase();
            mimetype =
                { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", mp4: "video/mp4", txt: "text/plain" }[ext]
                || mimetype;
        }

        // If record is dirty (not saved yet), preview the in-memory value to avoid showing old server content
        if (record.isDirty && data[fieldName]) {
            const dataUrl = `data:${mimetype};base64,${data[fieldName]}`;
            return this._openPreviewDialog(dataUrl, fileName);
        }

        // ---- Saved record: use /web/content with a cache-buster ----
        const base = "/web/content";
        const urlParts = [
            record.resModel,
            record.resId,
            fieldName,
            encodeURIComponent(fileName),
        ].join("/");

        // Best cache key: <field>_checksum; fallbacks to __last_update; final fallback: Date.now()
        const cacheKey =
            data[`${fieldName}_checksum`] ||
            data.__last_update ||
            String(Date.now());

        const previewUrl = `${base}/${urlParts}?download=0&unique=${encodeURIComponent(cacheKey)}`;
        this._openPreviewDialog(previewUrl, fileName);
    },

    _openPreviewDialog(url, fileName) {
        const downloadUrl = url.replace("download=0", "download=1");

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
