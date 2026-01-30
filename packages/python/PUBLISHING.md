# Publishing glyph-pdf to PyPI

This document contains the exact steps to publish the Python SDK to PyPI.

## Pre-requisites

1. **PyPI Account**: Create accounts on both:
   - TestPyPI: https://test.pypi.org/account/register/
   - PyPI: https://pypi.org/account/register/

2. **API Tokens**: Generate API tokens for upload:
   - TestPyPI: https://test.pypi.org/manage/account/token/
   - PyPI: https://pypi.org/manage/account/token/

3. **Install build tools**:
   ```bash
   pip install build twine
   ```

## Package Verification Checklist

Before publishing, verify:

- [x] `pyproject.toml` has all required fields
  - [x] name: `glyph-pdf`
  - [x] version: `0.1.0`
  - [x] description
  - [x] authors with email
  - [x] license (MIT)
  - [x] classifiers
  - [x] requires-python: `>=3.8`
  - [x] readme reference
  - [x] project.urls (Homepage, Documentation, Repository, Issues)

- [x] `glyph_pdf/__init__.py` exports:
  - [x] `Glyph` class (main client)
  - [x] `GlyphError` exception
  - [x] `glyph()` convenience function
  - [x] `__version__` variable

- [x] `py.typed` marker file exists (PEP 561 compliance)

- [x] Zero external dependencies (stdlib only)

- [x] README.md with usage examples

## Build the Package

```bash
cd packages/python

# Clean any previous builds
rm -rf dist/ build/ *.egg-info glyph_pdf/*.egg-info

# Build source distribution and wheel
python -m build

# Verify the build artifacts
ls -la dist/
# Should show:
#   glyph_pdf-0.1.0-py3-none-any.whl
#   glyph_pdf-0.1.0.tar.gz
```

## Test Upload (TestPyPI)

Always test on TestPyPI first:

```bash
# Upload to TestPyPI
twine upload --repository testpypi dist/*

# When prompted:
#   Username: __token__
#   Password: <your TestPyPI API token>

# Or use environment variables:
TWINE_USERNAME=__token__ TWINE_PASSWORD=pypi-... twine upload --repository testpypi dist/*
```

### Verify TestPyPI Installation

```bash
# Install from TestPyPI
pip install --index-url https://test.pypi.org/simple/ glyph-pdf

# Test it works
python -c "from glyph_pdf import Glyph; print('Success!')"
```

## Production Upload (PyPI)

Once TestPyPI verification passes:

```bash
# Upload to production PyPI
twine upload dist/*

# When prompted:
#   Username: __token__
#   Password: <your PyPI API token>

# Or use environment variables:
TWINE_USERNAME=__token__ TWINE_PASSWORD=pypi-... twine upload dist/*
```

### Verify Production Installation

```bash
pip install glyph-pdf
python -c "from glyph_pdf import Glyph; print('Success!')"
```

## Version Bumping

For future releases, update the version in TWO places:
1. `pyproject.toml` - line 7: `version = "X.Y.Z"`
2. `glyph_pdf/__init__.py` - line 12: `__version__ = "X.Y.Z"`

Follow semantic versioning:
- PATCH (0.1.1): Bug fixes
- MINOR (0.2.0): New features, backwards compatible
- MAJOR (1.0.0): Breaking changes

## Automation (Optional)

Configure `~/.pypirc` for easier uploads:

```ini
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = __token__
password = pypi-...

[testpypi]
repository = https://test.pypi.org/legacy/
username = __token__
password = pypi-...
```

Then upload with just:
```bash
twine upload --repository testpypi dist/*  # TestPyPI
twine upload dist/*                         # Production
```

## Troubleshooting

### "File already exists"
You cannot re-upload the same version. Bump the version number.

### "Invalid or non-existent authentication"
Check your API token. Make sure you're using `__token__` as the username.

### Package name already taken
The name `glyph-pdf` needs to be available on PyPI. Check: https://pypi.org/project/glyph-pdf/

## Current Status

**Ready for publishing**: YES

All required fields are present. The package uses zero external dependencies (stdlib only), has proper type hints with py.typed marker, and comprehensive documentation.

**Blocking items from Eddie**:
1. PyPI account credentials / API token
2. TestPyPI account credentials / API token (for testing first)
3. Decision: Is `glyph-pdf` the final package name?
