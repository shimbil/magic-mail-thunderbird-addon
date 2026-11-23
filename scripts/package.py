#!/usr/bin/env python3
# ==============================================================================
# Magic Mail - XPI Packaging Script
# Creates a Gecko-compliant Thunderbird WebExtension .xpi package.
# Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
# ==============================================================================
"""
Magic Mail Packaging Script
Creates a clean, Gecko-compliant Thunderbird WebExtension .xpi package with proper directory entries and Deflate compression.
Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
"""

import json
import os
import shutil
import subprocess
import sys
import zipfile


def package_xpi():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    manifest_path = os.path.join(root_dir, 'manifest.json')

    if not os.path.exists(manifest_path):
        print(f"Error: manifest.json not found at {manifest_path}")
        sys.exit(1)

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    version = manifest.get('version', '1.0')
    xpi_filename = f"MagicMail-v{version}.xpi"
    default_xpi_filename = "MagicMail.xpi"

    xpi_path = os.path.join(root_dir, xpi_filename)
    default_xpi_path = os.path.join(root_dir, default_xpi_filename)

    # Clean previous packages
    for path in [xpi_path, default_xpi_path]:
        if os.path.exists(path):
            os.remove(path)

    include_items = [
        'manifest.json',
        'background.js',
        'popup',
        'options',
        'services',
        'styles',
        'icons'
    ]

    print(f"Packaging Magic Mail v{version}...")

    # Check if native zip utility is available (standard for Gecko XPI packages)
    zip_bin = shutil.which('zip')
    if zip_bin:
        cmd = [
            zip_bin, '-9', '-r', xpi_path,
            *include_items,
            '-x', '*.pyc',
            '-x', '*.swp',
            '-x', '*__pycache__*',
            '-x', '*.DS_Store'
        ]
        result = subprocess.run(cmd, cwd=root_dir, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Warning: zip utility failed ({result.stderr}), using Python zipfile fallback.")
            build_with_zipfile(root_dir, xpi_path, include_items)
        else:
            print("  + Archived using standard Deflate zip utility with directory records.")
    else:
        build_with_zipfile(root_dir, xpi_path, include_items)

    # Copy to default package name
    shutil.copy2(xpi_path, default_xpi_path)

    xpi_size = os.path.getsize(xpi_path)
    print("\nSuccessfully generated:")
    print(f"   - {xpi_path} ({xpi_size / 1024:.1f} KB)")
    print(f"   - {default_xpi_path} ({xpi_size / 1024:.1f} KB)")
    return xpi_path


def build_with_zipfile(root_dir, xpi_path, include_items):
    exclude_extensions = {'.pyc', '.swp', '.DS_Store'}
    exclude_dirs = {'__pycache__', '.git', 'tests', 'scripts'}

    with zipfile.ZipFile(xpi_path, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
        for item in include_items:
            item_path = os.path.join(root_dir, item)
            if not os.path.exists(item_path):
                continue

            if os.path.isfile(item_path):
                zipf.write(item_path, arcname=item)
                print(f"  + {item}")
            elif os.path.isdir(item_path):
                for root, dirs, files in os.walk(item_path):
                    dirs[:] = [d for d in dirs if d not in exclude_dirs]

                    # Explicitly write directory entries (required by Gecko)
                    rel_dir = os.path.relpath(root, root_dir)
                    if rel_dir != '.':
                        dir_info = zipfile.ZipInfo(rel_dir.replace('\\', '/') + '/')
                        dir_info.external_attr = 0o40755 << 16
                        zipf.writestr(dir_info, '')

                    for file in files:
                        ext = os.path.splitext(file)[1]
                        if ext in exclude_extensions or file.startswith('.'):
                            continue
                        abs_file = os.path.join(root, file)
                        rel_arc = os.path.relpath(abs_file, root_dir).replace('\\', '/')
                        zipf.write(abs_file, arcname=rel_arc)
                        print(f"  + {rel_arc}")


if __name__ == '__main__':
    package_xpi()
