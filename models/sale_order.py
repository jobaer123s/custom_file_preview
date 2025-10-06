from odoo import models, fields


class SaleOrder(models.Model):
    _inherit = "sale.order"

    # A binary field that stores the file, set to be an attachment
    preview_file = fields.Binary("Preview File", attachment=True)
    preview_filename = fields.Char("Filename")
    pdf_file = fields.Binary("PDF File", attachment=True)
    pdf_filename = fields.Char("Filename")