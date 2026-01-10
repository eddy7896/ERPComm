import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/drive/v3.dart' as drive;
import 'package:extension_google_sign_in_as_googleapis_auth/extension_google_sign_in_as_googleapis_auth.dart';

class GoogleDriveFile {
  final String id;
  final String name;
  final String? mimeType;
  final String? webViewLink;
  final String? webContentLink;
  final String? thumbnailLink;
  final int? size;

  GoogleDriveFile({
    required this.id,
    required this.name,
    this.mimeType,
    this.webViewLink,
    this.webContentLink,
    this.thumbnailLink,
    this.size,
  });

  bool get isImage => mimeType?.startsWith('image/') ?? false;
  bool get isDocument => mimeType?.contains('document') ?? mimeType?.contains('pdf') ?? false;
  bool get isFolder => mimeType == 'application/vnd.google-apps.folder';
}

class GoogleDriveService {
  static final GoogleDriveService _instance = GoogleDriveService._internal();
  factory GoogleDriveService() => _instance;
  GoogleDriveService._internal();

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  );

  GoogleSignInAccount? _currentUser;
  drive.DriveApi? _driveApi;

  bool get isSignedIn => _currentUser != null;

  Future<bool> signIn() async {
    try {
      _currentUser = await _googleSignIn.signIn();
      if (_currentUser == null) return false;

      final httpClient = await _googleSignIn.authenticatedClient();
      if (httpClient == null) return false;

      _driveApi = drive.DriveApi(httpClient);
      return true;
    } catch (e) {
      debugPrint('Google Sign-In error: $e');
      return false;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    _currentUser = null;
    _driveApi = null;
  }

  Future<List<GoogleDriveFile>> listFiles({
    String? folderId,
    String? query,
    int pageSize = 20,
  }) async {
    if (_driveApi == null) {
      final signedIn = await signIn();
      if (!signedIn) return [];
    }

    try {
      String q = "trashed = false";
      if (folderId != null) {
        q += " and '$folderId' in parents";
      }
      if (query != null && query.isNotEmpty) {
        q += " and name contains '$query'";
      }

      final fileList = await _driveApi!.files.list(
        q: q,
        pageSize: pageSize,
        $fields: 'files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size)',
        orderBy: 'modifiedTime desc',
      );

      return fileList.files?.map((f) => GoogleDriveFile(
        id: f.id ?? '',
        name: f.name ?? 'Untitled',
        mimeType: f.mimeType,
        webViewLink: f.webViewLink,
        webContentLink: f.webContentLink,
        thumbnailLink: f.thumbnailLink,
        size: f.size != null ? int.tryParse(f.size!) : null,
      )).toList() ?? [];
    } catch (e) {
      debugPrint('Error listing files: $e');
      return [];
    }
  }

  Future<GoogleDriveFile?> getFile(String fileId) async {
    if (_driveApi == null) {
      final signedIn = await signIn();
      if (!signedIn) return null;
    }

    try {
      final file = await _driveApi!.files.get(
        fileId,
        $fields: 'id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size',
      ) as drive.File;

      return GoogleDriveFile(
        id: file.id ?? '',
        name: file.name ?? 'Untitled',
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        thumbnailLink: file.thumbnailLink,
        size: file.size != null ? int.tryParse(file.size!) : null,
      );
    } catch (e) {
      debugPrint('Error getting file: $e');
      return null;
    }
  }

  String getExportUrl(GoogleDriveFile file) {
    if (file.webContentLink != null) {
      return file.webContentLink!;
    }
    return 'https://drive.google.com/uc?export=download&id=${file.id}';
  }

  String getViewUrl(GoogleDriveFile file) {
    if (file.webViewLink != null) {
      return file.webViewLink!;
    }
    return 'https://drive.google.com/file/d/${file.id}/view';
  }
}
