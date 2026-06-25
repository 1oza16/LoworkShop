# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['loworkshop.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        "weasyprint",
        "weasyprint.text",
        "weasyprint.text.fonts",
        "weasyprint.css",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='loworkshop',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='img/favicon.ico'
)
