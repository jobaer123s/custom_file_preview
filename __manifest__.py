{
    'name': 'Document Preview',
    'summary': 'Document Preview',
    'version': '16.0.0',
    'category': 'Tools',
    'author': 'Jobaer',
    'license': 'LGPL-3',
    'depends': [
            'base', 'web', 'mail'
        ],
    'data': [
            # 'views/sale_order.xml'
        ],
    'assets': {
        'web.assets_backend': [
            'custom_file_preview/static/src/**/*',
        ]
    },
    'description': 'File Preview ',
}