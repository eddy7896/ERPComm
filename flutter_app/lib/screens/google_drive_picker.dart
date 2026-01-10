import 'package:flutter/material.dart';
import 'package:ERPComm/services/google_drive_service.dart';
import 'package:ERPComm/theme/shad_theme.dart';

class GoogleDrivePicker extends StatefulWidget {
  final Function(GoogleDriveFile) onFileSelected;

  const GoogleDrivePicker({super.key, required this.onFileSelected});

  @override
  State<GoogleDrivePicker> createState() => _GoogleDrivePickerState();
}

class _GoogleDrivePickerState extends State<GoogleDrivePicker> {
  final _driveService = GoogleDriveService();
  final _searchController = TextEditingController();
  List<GoogleDriveFile> _files = [];
  List<String> _folderStack = [];
  bool _isLoading = false;
  bool _isSignedIn = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkSignIn();
  }

  Future<void> _checkSignIn() async {
    setState(() => _isLoading = true);
    final signedIn = await _driveService.signIn();
    setState(() {
      _isSignedIn = signedIn;
      _isLoading = false;
    });
    if (signedIn) {
      _loadFiles();
    }
  }

  Future<void> _loadFiles({String? folderId, String? query}) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final files = await _driveService.listFiles(
        folderId: folderId ?? (_folderStack.isNotEmpty ? _folderStack.last : null),
        query: query,
        pageSize: 50,
      );
      setState(() {
        _files = files;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load files';
        _isLoading = false;
      });
    }
  }

  void _openFolder(GoogleDriveFile folder) {
    setState(() {
      _folderStack.add(folder.id);
    });
    _loadFiles(folderId: folder.id);
  }

  void _goBack() {
    if (_folderStack.isNotEmpty) {
      setState(() {
        _folderStack.removeLast();
      });
      _loadFiles(folderId: _folderStack.isNotEmpty ? _folderStack.last : null);
    }
  }

  void _onSearch(String query) {
    _loadFiles(query: query.isNotEmpty ? query : null);
  }

  IconData _getFileIcon(GoogleDriveFile file) {
    if (file.isFolder) return Icons.folder;
    if (file.isImage) return Icons.image;
    if (file.mimeType?.contains('pdf') ?? false) return Icons.picture_as_pdf;
    if (file.mimeType?.contains('spreadsheet') ?? false) return Icons.table_chart;
    if (file.mimeType?.contains('presentation') ?? false) return Icons.slideshow;
    if (file.mimeType?.contains('document') ?? false) return Icons.description;
    if (file.mimeType?.contains('video') ?? false) return Icons.video_file;
    if (file.mimeType?.contains('audio') ?? false) return Icons.audio_file;
    return Icons.insert_drive_file;
  }

  Color _getFileColor(GoogleDriveFile file) {
    if (file.isFolder) return const Color(0xFF8ab4f8);
    if (file.isImage) return const Color(0xFFf28b82);
    if (file.mimeType?.contains('pdf') ?? false) return const Color(0xFFea4335);
    if (file.mimeType?.contains('spreadsheet') ?? false) return const Color(0xFF34a853);
    if (file.mimeType?.contains('presentation') ?? false) return const Color(0xFFfbbc04);
    if (file.mimeType?.contains('document') ?? false) return const Color(0xFF4285f4);
    return ShadColors.mutedForeground;
  }

  String _formatFileSize(int? bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: const BoxDecoration(
        color: ShadColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        children: [
          _buildHeader(),
          if (!_isSignedIn && !_isLoading)
            _buildSignInPrompt()
          else if (_isLoading && _files.isEmpty)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            _buildError()
          else
            Expanded(child: _buildFileList()),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: ShadColors.border)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              if (_folderStack.isNotEmpty)
                IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: _goBack,
                )
              else
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4285f4).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Image.network(
                    'https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
                    width: 24,
                    height: 24,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.cloud,
                      color: Color(0xFF4285f4),
                    ),
                  ),
                ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Google Drive',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search files...',
              prefixIcon: const Icon(Icons.search, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: ShadColors.border),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
            onSubmitted: _onSearch,
          ),
        ],
      ),
    );
  }

  Widget _buildSignInPrompt() {
    return Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF4285f4).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.cloud_outlined,
                size: 48,
                color: Color(0xFF4285f4),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Connect to Google Drive',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Sign in to access your files',
              style: TextStyle(
                color: ShadColors.mutedForeground,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _checkSignIn,
              icon: const Icon(Icons.login),
              label: const Text('Sign in with Google'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4285f4),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: ShadColors.destructive),
            const SizedBox(height: 16),
            Text(_error ?? 'An error occurred'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadFiles,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileList() {
    if (_files.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.folder_open, size: 48, color: ShadColors.mutedForeground),
            SizedBox(height: 16),
            Text('No files found', style: TextStyle(color: ShadColors.mutedForeground)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadFiles(),
      child: ListView.builder(
        itemCount: _files.length,
        itemBuilder: (context, index) {
          final file = _files[index];
          return _buildFileItem(file);
        },
      ),
    );
  }

  Widget _buildFileItem(GoogleDriveFile file) {
    return InkWell(
      onTap: () {
        if (file.isFolder) {
          _openFolder(file);
        } else {
          widget.onFileSelected(file);
          Navigator.pop(context);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: ShadColors.border, width: 0.5)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _getFileColor(file).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: file.thumbnailLink != null && file.isImage
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        file.thumbnailLink!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Icon(
                          _getFileIcon(file),
                          color: _getFileColor(file),
                        ),
                      ),
                    )
                  : Icon(
                      _getFileIcon(file),
                      color: _getFileColor(file),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    file.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (file.size != null)
                    Text(
                      _formatFileSize(file.size),
                      style: const TextStyle(
                        fontSize: 12,
                        color: ShadColors.mutedForeground,
                      ),
                    ),
                ],
              ),
            ),
            if (file.isFolder)
              const Icon(Icons.chevron_right, color: ShadColors.mutedForeground),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
