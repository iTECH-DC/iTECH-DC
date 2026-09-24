# Alice OS 12.6 — Windows 11 inspired File Manager

The Files & Data app now provides a full local desktop file-management surface while keeping Alice's security boundary.

## Included
- Home / This PC style navigation
- Breadcrumb and editable address bar
- Back / Forward / Up navigation
- Search within the current folder
- Details and grid views
- Sort by name/type/size
- Preview pane for metadata and local images/text
- New folders and text files
- Multi-file upload into the current folder
- Open/download local files
- Rename, copy, cut, paste, move
- Delete-to-Recycle-Bin instead of immediate permanent deletion
- Context menus and Properties
- Keyboard integration through the Alice shortcut layer

## Security boundary
All file operations are confined to the Alice project directory. Paths are resolved and rejected if they escape the project root. Uploaded content has a 50 MB limit; text preview has a 1.5 MB limit. Deletion moves items into `.alice_recycle` rather than silently destroying data.

## Host integration
This is an Alice-local file manager. It does not pretend to be the host Windows Explorer process. Native OS integration can be added after Alice has a booted native desktop runtime.
