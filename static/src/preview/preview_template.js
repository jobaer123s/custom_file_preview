/** @odoo-module **/

import { Component } from "@odoo/owl";

export class PreviewBody extends Component {
    static props = {
        url: String,
        filename: { type: String, optional: true },
        height: { type: String, optional: true }, // e.g. "80vh"
        close: { type: Function, optional: true },
    };
}
PreviewBody.template = "custom_file_preview.PreviewBody";